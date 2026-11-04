import "server-only";
import { generatedProblemSchema, type GeneratedProblem } from "@/lib/ai/schemas";
import { subUnitsOf } from "@/lib/curriculum/subUnits";
import { SUBJECT_CONFIG } from "@/lib/curriculum/subjects";
import { toRubyParts } from "@/lib/curriculum/toRubyParts";
import { answersMatch, normalizeAnswer } from "@/lib/utils/answers";

export interface ValidationResult {
  readonly ok: boolean;
  /** 見つかった問題。先頭の単語(schema / subject / choices / answer / leak / hint / ruby / katakana / listenText / template / tone)で種類がわかる */
  readonly issues: readonly string[];
}

const KANJI = /\p{Script=Han}/u;
/** カタカナの文字(中点「・」と長音「ー」は ひらがなの文にも出るので数えない)。NFKC にそろえた文に使う。 */
const KATAKANA = /[ァ-ヺヽ-ヿ]/;
const ASCII_TEXT = /^[\x20-\x7E]+$/;
const TEMPLATE_BUG = /undefined|NaN|\bnull\b|\[object|\{\{|\}\}|\$\{/;
const NUMBER_ANSWER = /^(\d+)\D*$/;

/** 子どもに見せる文で使わない言葉(否定しない・おどさない)。 */
const DISCOURAGING = ["だめ", "ダメ", "駄目", "ばか", "バカ", "馬鹿", "できない", "むり", "無理", "へた", "下手"];
/** 「ばか」「むり」などを ふくむが、わるい意味ではない ふつうの語。調べる前にぬく。 */
const HARMLESS_WORDS = ["ことばか", "ことばかり", "ばかり", "ねむり", "かんむり", "ほおずり"];

const hintTexts = (problem: GeneratedProblem): string[] => Object.values(problem.hints);
const visibleTexts = (problem: GeneratedProblem): string[] => [problem.problemText, ...(problem.choices ?? []), ...hintTexts(problem)];

/** かぎかっこの中は出題の対象(たずねる文・読みをたずねる漢字など)なので、ルビも答えの先出しも見ない。 */
const BRACKETED = /「[^」]*」|『[^』]*』|【[^】]*】/g;

const collapse = (text: string): string => text.normalize("NFKC").replace(/\s+/g, " ").trim();
const compact = (text: string): string => text.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 1 文字の答えが、ことばの一部ではなく、それだけで(空白・かっこ・句読点にはさまれて)出ているか。 */
const standalone = (text: string, char: string): boolean =>
  new RegExp(`(?:^|[\\s「『【（(])${escapeRegExp(char)}(?:$|[\\s」』】）)、。！？!?])`, "u").test(text);

/**
 * 答えが文のなかに出ているか。
 * - 数字の答えは「数字のかたまり」で比べる(212 の中の 12 には反応しない)
 * - 英数字をふくむ答えは、空白と大文字小文字のちがいを無視して比べる
 * - かなと漢字だけの答えは、空白をつなげずに比べる(「は なんと」の中に「はな」を見つけない)
 * - 1 文字の答えは、それだけで出ているときだけ
 */
function mentionsAnswer(text: string, answer: string): boolean {
  const target = collapse(answer);
  const haystack = text.normalize("NFKC").replace(/\s+/g, " ");
  const number = NUMBER_ANSWER.exec(compact(answer));
  if (number) return (haystack.match(/\d+/g) ?? []).some((token) => Number(token) === Number(number[1]));
  if ([...target].length >= 2) return /[A-Za-z0-9]/.test(target) ? compact(haystack).includes(compact(target)) : haystack.includes(target);
  return standalone(haystack, target);
}

/** かぎかっこの外にある漢字のうち、ルビ辞書に読みがないもの。 */
function kanjiWithoutReading(text: string): string[] {
  const outside = text.replace(BRACKETED, " ");
  if (!KANJI.test(outside)) return [];
  return toRubyParts(outside)
    .filter((part) => !part.ruby)
    .flatMap((part) => [...part.text].filter((char) => KANJI.test(char)));
}

function checkCurriculum(problem: GeneratedProblem): string[] {
  const issues: string[] = [];
  if (!SUBJECT_CONFIG[problem.subject].units.includes(problem.unit)) {
    issues.push(`subject: ${problem.unit} is not a ${problem.subject} unit`);
  }
  if (!subUnitsOf(problem.unit).includes(problem.subUnit)) {
    issues.push(`subUnit: ${problem.subUnit} is not a sub-unit of ${problem.unit}`);
  }
  return issues;
}

function checkChoices(problem: GeneratedProblem): string[] {
  const { choices, correctAnswer } = problem;
  if (!choices) return [];
  const issues: string[] = [];
  if (new Set(choices.map(normalizeAnswer)).size !== choices.length) issues.push("choices: duplicate choices");
  if (!choices.includes(correctAnswer)) issues.push("answer: correctAnswer is not one of the choices");
  const matching = choices.filter((choice) => answersMatch(choice, correctAnswer)).length;
  if (matching !== 1) issues.push(`answer: ${matching} choices match the correct answer`);
  return issues;
}

function checkLeaks(problem: GeneratedProblem): string[] {
  const question = problem.problemText.replace(BRACKETED, " ");
  const shownBeforeAnswer = [question, problem.hints.hint1, problem.hints.hint2];
  return shownBeforeAnswer.some((text) => mentionsAnswer(text, problem.correctAnswer))
    ? ["leak: the answer appears in the question or in hint 1 / hint 2"]
    : [];
}

const FIRST_CHARS_HINT = /「(.{1,3}?)」から はじまる/u;
const LENGTH_HINT = /(\d+)もじ/u;

/** ヒントが「はじめの字」「字数」で、4 つの選択肢のうち答えだけを残してしまうか。 */
function narrowsToAnswer(problem: GeneratedProblem, hint: string): boolean {
  const { choices, correctAnswer } = problem;
  if (!choices) return false;
  const answerKey = normalizeAnswer(correctAnswer);
  const onlyAnswer = (matches: readonly string[]): boolean => matches.length === 1 && normalizeAnswer(matches[0]) === answerKey;
  const prefix = FIRST_CHARS_HINT.exec(hint)?.[1];
  if (prefix && onlyAnswer(choices.filter((choice) => normalizeAnswer(choice).startsWith(normalizeAnswer(prefix))))) return true;
  const length = LENGTH_HINT.exec(hint)?.[1];
  return Boolean(length) && onlyAnswer(choices.filter((choice) => [...normalizeAnswer(choice)].length === Number(length)));
}

/** ヒント 1・2 は、答えそのものを言わなくても、選択肢をひとつにしぼってはいけない(答えのヒントだけが答えを教える)。 */
function checkHints(problem: GeneratedProblem): string[] {
  return [problem.hints.hint1, problem.hints.hint2].some((hint) => narrowsToAnswer(problem, hint))
    ? ["hint: hint 1 / hint 2 narrows the choices down to the answer"]
    : [];
}

function checkRuby(problem: GeneratedProblem): string[] {
  const missing = new Set([problem.problemText, ...hintTexts(problem)].flatMap(kanjiWithoutReading));
  return missing.size > 0 ? [`ruby: no reading in the ruby dictionary for ${[...missing].join("")}`] : [];
}

function checkEnglish(problem: GeneratedProblem): string[] {
  if (problem.subject !== "english") {
    return problem.listenText === undefined ? [] : ["listenText: only english problems may have listenText"];
  }
  const issues: string[] = [];
  if (problem.listenText !== undefined && !ASCII_TEXT.test(problem.listenText)) issues.push("listenText: must be plain ASCII English");
  // 英語は聞いて えらぶ(書かせない)
  if (!problem.choices) issues.push("choices: english problems must be multiple choice (no writing English)");
  if (visibleTexts(problem).some((text) => KATAKANA.test(text.normalize("NFKC")))) {
    issues.push("katakana: english problems must not show katakana readings");
  }
  return issues;
}

const isDiscouraging = (text: string): boolean => {
  const cleaned = HARMLESS_WORDS.reduce((acc, word) => acc.split(word).join(""), text);
  return DISCOURAGING.some((word) => cleaned.includes(word));
};

function checkText(problem: GeneratedProblem): string[] {
  const issues: string[] = [];
  const texts = visibleTexts(problem);
  if (texts.some((text) => TEMPLATE_BUG.test(text))) issues.push("template: leftover placeholder text");
  if (texts.some(isDiscouraging)) issues.push("tone: problem text, choices and hints must not discourage the child");
  return issues;
}

/**
 * 生成した問題を、保存・表示する前に検査する(テンプレート生成も AI 生成も同じ関門を通す)。
 * 形(Zod)・教科と単元・選択肢・答えの先出し・ヒントが答えをしぼらないか・ルビ・英語の決まり・文言を見る。
 */
export function validateGenerated(candidate: unknown): ValidationResult {
  const parsed = generatedProblemSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => `schema: ${issue.path.join(".")}: ${issue.message}`) };
  }
  const problem = parsed.data;
  const issues = [
    ...checkCurriculum(problem),
    ...checkChoices(problem),
    ...checkLeaks(problem),
    ...checkHints(problem),
    ...checkRuby(problem),
    ...checkEnglish(problem),
    ...checkText(problem),
  ];
  return { ok: issues.length === 0, issues };
}
