import "server-only";
import { GRADE_2_ALL_UNITS, type Subject } from "@/lib/curriculum/subjects";
import { toRubyParts } from "@/lib/curriculum/toRubyParts";
import { CHOICE_COUNT } from "@/lib/review/choices";
import { answersMatch, normalizeAnswer } from "@/lib/utils/answers";
import { createRandom, hashSeed, shuffle } from "@/lib/utils/random";
import type { GenerateInput, GeneratedProblem, GeneratorEntry } from "./types";
import { validateGenerated } from "./validate";

export type Random = () => number;

/** ref に入れる seed の長さの上限。ref は 200 文字までなので、これより長い seed は短い文字にたたむ。 */
const MAX_SEED_LENGTH = 64;
const foldedSeed = (seed: string): string =>
  seed.length <= MAX_SEED_LENGTH ? seed : `~${hashSeed(seed).toString(36)}${hashSeed(`${seed}#`).toString(36)}`;

/** 同じ問題を作り直すための手がかり。`単元/小単元/L<レベル>/<seed>` */
export const refOf = ({ unit, subUnit, level, seed }: GenerateInput): string => `${unit}/${subUnit}/L${level}/${foldedSeed(seed)}`;

/** 入力から決まる乱数(同じ入力なら同じ並び)。 */
export const randomFor = (input: GenerateInput): Random => createRandom(refOf(input));

/**
 * 答え 1 つと まちがい候補から、4 つの選択肢を作る(答えと同じ意味のもの・重なるものは候補から外す)。
 * 候補が足りないときは、作る側のまちがいなので RangeError。
 */
export function fourChoices(answer: string, wrongCandidates: readonly string[], random: Random): string[] {
  const seen = new Set([normalizeAnswer(answer)]);
  const wrong: string[] = [];
  for (const candidate of shuffle(wrongCandidates, random)) {
    const key = normalizeAnswer(candidate);
    if (seen.has(key) || answersMatch(candidate, answer)) continue;
    seen.add(key);
    wrong.push(candidate);
    if (wrong.length === CHOICE_COUNT - 1) break;
  }
  if (wrong.length < CHOICE_COUNT - 1) throw new RangeError(`not enough distractors for "${answer}"`);
  return shuffle([answer, ...wrong], random);
}

const PRAISES = [
  "すごい！ せいかい！ よく できたね。",
  "ばっちり！ そのちょうし！",
  "やったね！ しっかり かんがえられたね。",
  "いいね！ じぶんの ちからで できたよ。",
] as const;

/** 正解のときのほめ言葉(否定しない)。 */
export const praiseOf = (random: Random): string => PRAISES[Math.floor(random() * PRAISES.length)];

/** 答えの漢字にルビの読みがないとき、かぎかっこで囲む(画面は かっこの中にルビを付けず、そのまま見せる)。 */
const shownAnswer = (answer: string): string =>
  toRubyParts(answer).some((part) => !part.ruby && /\p{Script=Han}/u.test(part.text)) ? `『${answer}』` : answer;

/** ヒント 5 つ組(ヒント1 → ヒント2 → 解き方 → 答え → ほめ言葉)。hint1・hint2 に答えを入れないこと(validateGenerated が見張る)。 */
export function hintSet(random: Random, hint1: string, hint2: string, solution: string, answer: string): GeneratedProblem["hints"] {
  return { hint1, hint2, solution, answer: `こたえは ${shownAnswer(answer)} だよ。`, praise: praiseOf(random) };
}

/** 生成器がつくる問題の中身(ヒントの言葉と 4 択の元)。入れ物は `specEntry` が用意する。 */
export interface ProblemSpec {
  readonly problemText: string;
  readonly answer: string;
  /** 4 択にするときの まちがいの候補(3 つ以上)。無ければ、数字などを入力して答える形になる */
  readonly wrong?: readonly string[];
  /** 「えいごを きく」で読む英語(英語の教科だけ) */
  readonly listenText?: string;
  readonly hint1: string;
  readonly hint2: string;
  readonly solution: string;
}

export interface SpecContext {
  readonly input: GenerateInput;
  readonly level: GenerateInput["level"];
  readonly random: Random;
}

interface EntryDefinition {
  readonly subject: Subject;
  readonly unit: string;
  readonly subUnit: string;
  readonly levels: GeneratorEntry["levels"];
}

/** 検査に通る問題が出るまで、seed に「#1」「#2」…を足して つくりなおす上限。 */
const MAX_ATTEMPTS = 12;

/** つくれなかった(選択肢の候補が足りない など。RangeError)ときは null。ほかのエラーは作りまちがいなので、そのまま投げる。 */
function tryBuild(build: (input: GenerateInput) => GeneratedProblem, input: GenerateInput): GeneratedProblem | null {
  try {
    return build(input);
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/**
 * 1 回きりの生成関数に、検査と やりなおしを足す。
 * ref はいつも元の入力のものにそろえる(保存した ref から、同じ やりなおしをたどって同じ問題に戻れる)。
 */
export function validatedGenerate(build: (input: GenerateInput) => GeneratedProblem): (input: GenerateInput) => GeneratedProblem {
  return (input) => {
    // やりなおしの seed は たたんだ seed につなぐ(ref に残るのは たたんだ seed なので、ref から同じやりなおしをたどれる)
    const base = foldedSeed(input.seed);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const seed = attempt === 0 ? input.seed : `${base}#${attempt}`;
      const problem = tryBuild(build, { ...input, seed });
      if (problem && validateGenerated({ ...problem, ref: refOf(input) }).ok) return { ...problem, ref: refOf(input) };
    }
    throw new RangeError(`could not generate a valid problem for ${refOf(input)}`);
  };
}

export function makeEntry(definition: EntryDefinition, build: (input: GenerateInput) => GeneratedProblem): GeneratorEntry {
  return { ...definition, generateOnce: build, generate: validatedGenerate(build) };
}

/** ProblemSpec を返す関数から、GeneratorEntry(乱数・4択・ヒント・ref・検査つき)をつくる。 */
export function specEntry(definition: EntryDefinition, build: (context: SpecContext) => ProblemSpec): GeneratorEntry {
  return makeEntry(definition, (input) => {
    const random = randomFor(input);
    const spec = build({ input, level: input.level, random });
    return buildProblem(definition.subject, input, {
      problemText: spec.problemText,
      correctAnswer: spec.answer,
      choices: spec.wrong ? fourChoices(spec.answer, spec.wrong, random) : undefined,
      listenText: spec.listenText,
      hints: hintSet(random, spec.hint1, spec.hint2, spec.solution, spec.answer),
    });
  });
}

interface ProblemFields {
  readonly problemText: string;
  readonly correctAnswer: string;
  readonly choices?: readonly string[];
  readonly listenText?: string;
  readonly hints: GeneratedProblem["hints"];
}

/** 単元名を、定数リストの単元に絞る(知らない単元名は生成器の作りまちがいなので RangeError)。 */
const toUnit = (unit: string): GeneratedProblem["unit"] => {
  const known = GRADE_2_ALL_UNITS.find((candidate) => candidate === unit);
  if (!known) throw new RangeError(`unknown unit: ${unit}`);
  return known;
};

/** 生成器の出力の共通部分(教科・単元・小単元・レベル・ref)を付けて、問題を組み立てる。 */
export function buildProblem(subject: Subject, input: GenerateInput, fields: ProblemFields): GeneratedProblem {
  return {
    subject,
    unit: toUnit(input.unit),
    subUnit: input.subUnit,
    level: input.level,
    problemText: fields.problemText,
    correctAnswer: fields.correctAnswer,
    ...(fields.choices ? { choices: [...fields.choices] } : {}),
    ...(fields.listenText ? { listenText: fields.listenText } : {}),
    hints: fields.hints,
    ref: refOf(input),
  };
}
