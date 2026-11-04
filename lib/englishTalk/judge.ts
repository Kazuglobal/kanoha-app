import type { TalkScene, TalkTurn } from "@/lib/curriculum/englishTalkScenes";
import { containsPhrase, coreTokens, matchesAccept, modelOverlap, phraseTokens } from "./match";
import { canonicalize, classifyUtterance, normalizeEnglish } from "./normalize";
import { isDontKnowAnswer } from "./dontKnow";

// 以前から judge.ts を窓口にしている名前(分けたあとも同じ場所から使える)
export { detectChosenFruit, type ChosenFruit } from "./context";
export { isDontKnowAnswer, isExplicitDontKnow } from "./dontKnow";
export { normalizeEnglish, normalizeSpokenEnglish } from "./normalize";

/** クライアントへ渡すシーン(accept / modelAnswer を含めない)。 */
export interface PublicTalkTurn {
  readonly id: string;
  readonly prompt: string;
  readonly promptJa: string;
  readonly answerHintJa: string;
  readonly choices: readonly string[];
  readonly visual?: string;
}

export interface PublicTalkScene {
  readonly id: string;
  readonly title: string;
  readonly titleEn: string;
  readonly description: string;
  readonly emoji: string;
  readonly background: string;
  readonly turns: readonly PublicTalkTurn[];
}

/** choice: 4択 / voice: 声や文字のこたえ / repeat: 正しい言い方のまね */
export type JudgeMode = "choice" | "voice" | "repeat";

export interface JudgeResult {
  correct: boolean;
  /** 日本語だけの答え(英語の中身がない)。まちがいにはせず、英語で言ってもらう */
  needsEnglish?: boolean;
  /** 聞き取れなかった(記号だけ・書き起こしの印だけ)。まちがいにはせず、もう一度言ってもらう */
  unclear?: boolean;
  /** 4択のはずなのに、選択肢にない文字が来た */
  invalidChoice?: boolean;
}

/** まねして言うとき、お手本の語がこの割合以上入っていること。 */
const REPEAT_MIN_OVERLAP = 0.6;

/** まちがえたときにすぐ英語で伝える正しいフィードバック文を組み立てる。 */
export const buildCorrectiveFeedbackEn = (
  turnOrModelAnswer: Pick<TalkTurn, "modelAnswer" | "feedbackEn"> | string,
  explicitFeedbackEn?: string,
): string => {
  if (explicitFeedbackEn?.trim()) return explicitFeedbackEn.trim();
  if (typeof turnOrModelAnswer === "string") {
    const model = turnOrModelAnswer.trim();
    return model ? `Nice try! Say: ${model}` : "Nice try! Let's try again.";
  }
  if (turnOrModelAnswer.feedbackEn?.trim()) {
    return turnOrModelAnswer.feedbackEn.trim();
  }
  return `Nice try! Say: ${turnOrModelAnswer.modelAnswer}`;
};

const NON_NAME_WORDS = new Set([
  "fine", "good", "great", "happy", "ok", "okay", "hungry", "sleepy", "tired", "sad",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "zero",
  "here", "ready", "sorry", "sure", "not", "dont", "do", "a", "an", "the", "sunny",
  "apples", "apple", "cat", "dog", "goodbye", "bye",
  "is", "am", "are", "my", "name", "your", "you",
]);

/** 名前を言う文の はじまり(あいさつや つなぎの語のあとでもよい)。続きの言葉が名前。 */
const NAME_FRAME = /^(?:(?:hello|hi|hey|yes|well|um|uh)\s+)*(?:i am|my name is|my name|name is|call me)\s+(.+)$/;
const JAPANESE_NAME_FRAME = /(?:i'm|i\s+am|my\s+name|アイム|あいむ|マイネーム|まいねーむ)\s*([ぁ-んァ-ヶ一-龠々ー]{1,12})/i;

/**
 * 「What's your name?」では「My name is Sora.」「I'm Sora.」「I'm ゆうき」のように、名前を言えば正解にする。
 * 名前のない「My name is」や、「I'm fine」「I'm a cat」「Your name is …」は名前にしない。tokens は canonicalize ずみ。
 */
function matchesName(answer: string, tokens: readonly string[]): boolean {
  const frame = NAME_FRAME.exec(tokens.join(" "));
  const names = (frame?.[1].split(" ") ?? []).filter((token) => /^[a-z]{2,20}$/.test(token) && !NON_NAME_WORDS.has(token));
  if (names.length > 0) return true;
  const japanese = JAPANESE_NAME_FRAME.exec(answer.normalize("NFKC"));
  // 続きが「ファイン」のような外来語なら名前ではない
  return Boolean(japanese) && classifyUtterance(japanese![1]).tokens.length === 0;
}

/** 別名で判定するとき、accept のほかに言ってよい語: お手本の答えと問いの言葉(「Good warning」「Tree apples」)。 */
const allowedExtra = (turn: TalkTurn): string[] => [...phraseTokens(turn.modelAnswer), ...phraseTokens(turn.prompt)];

const isRejected = (turn: TalkTurn, spoken: readonly string[]): boolean =>
  (turn.reject ?? []).some((phrase) => containsPhrase(spoken, phraseTokens(phrase)));

function judgeChoice(turn: TalkTurn, answer: string): JudgeResult {
  const normalized = normalizeEnglish(answer);
  const chosen = turn.choices.find((choice) => normalizeEnglish(choice) === normalized);
  if (!chosen) return { correct: false, invalidChoice: true };
  return { correct: normalizeEnglish(chosen) === normalizeEnglish(turn.modelAnswer) };
}

/**
 * 答えの判定。
 * - choice: 選択肢の中のお手本だけが正解(選択肢にない文字は無効)
 * - voice : 日本語だけの答えは正解にせず英語で言ってもらう。英語(カタカナの外来語も)は accept に合えば正解
 * - repeat: voice に加えて、お手本の言い方に近いこと(1語だけでは正解にしない)
 */
export function judgeTalk(turn: TalkTurn, answer: string, mode: JudgeMode): JudgeResult {
  if (mode === "choice") return judgeChoice(turn, answer);
  if (isDontKnowAnswer(answer)) return { correct: false };

  const { kind, tokens } = classifyUtterance(answer);
  if (kind === "empty") return { correct: false, unclear: true };
  if (kind === "japanese") return { correct: false, needsEnglish: true };

  const spoken = canonicalize(tokens);
  const isNameTurn = turn.id === "greeting-name";
  const nameMatch = isNameTurn && matchesName(answer, spoken);
  // 英語の中身がなく、日本語の言葉が主なとき(「It's いぬ」)は、まちがいにせず英語で言ってもらう
  if (kind === "mixed" && coreTokens(spoken).length === 0 && !nameMatch) return { correct: false, needsEnglish: true };

  const matched = isNameTurn
    ? nameMatch
    : matchesAccept(turn.accept, spoken, allowedExtra(turn)) && !isRejected(turn, spoken);
  if (!matched) return { correct: false };
  if (mode === "repeat" && modelOverlap(turn.modelAnswer, spoken) < REPEAT_MIN_OVERLAP) return { correct: false };
  return { correct: true };
}

/** 声や文字のこたえの判定(以前からの名前)。 */
export const judgeTalkAnswer = (turn: TalkTurn, answer: string): boolean => judgeTalk(turn, answer, "voice").correct;

const hash = (text: string): number =>
  [...text].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);

/** turn id から決まる並び(サーバー描画とクライアントで同じ順になる)。 */
const shuffleChoices = (turn: TalkTurn): readonly string[] =>
  [...turn.choices]
    .map((choice) => ({ choice, key: hash(`${turn.id}:${choice}`) }))
    .sort((a, b) => a.key - b.key)
    .map(({ choice }) => choice);

export const toPublicScene = (scene: TalkScene): PublicTalkScene => ({
  id: scene.id,
  title: scene.title,
  titleEn: scene.titleEn,
  description: scene.description,
  emoji: scene.emoji,
  background: scene.background,
  turns: scene.turns.map((turn) => ({
    id: turn.id,
    prompt: turn.prompt,
    promptJa: turn.promptJa,
    answerHintJa: turn.answerHintJa,
    choices: shuffleChoices(turn),
    ...(turn.visual ? { visual: turn.visual } : {}),
  })),
});
