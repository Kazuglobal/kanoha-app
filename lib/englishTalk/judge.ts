import type { TalkScene, TalkTurn } from "@/lib/curriculum/englishTalkScenes";

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

/** 小文字化・アポストロフィ除去・記号除去・空白の正規化。 */
export const normalizeEnglish = (text: string): string =>
  text
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const containsPhrase = (normalized: string, phrase: string): boolean =>
  ` ${normalized} `.includes(` ${normalizeEnglish(phrase)} `);

const DONT_KNOW_ENGLISH_PHRASES = [
  "i dont know",
  "dont know",
  "do not know",
  "i do not know",
  "dunno",
  "no idea",
  "i have no idea",
  "not sure",
  "im not sure",
  "i am not sure",
  "i dont understand",
  "dont understand",
  "do not understand",
  "i do not understand",
  "cant understand",
  "cannot understand",
  "what does it mean",
  "what does that mean",
  "what do you mean",
  "help me",
  "in japanese",
  "japanese please",
  "speak japanese",
  "wakaranai",
  "wakarimasen",
  "wakannai",
  "waka ranai",
  "walk around night",
  "walk around i",
  "what got a night",
  "what can i night",
  "what car a night",
  "water a night",
  "wanna cry night",
  "work around night",
  "what color night",
] as const;

const DONT_KNOW_SINGLE_WORDS = new Set([
  "help",
  "hint",
  "japanese",
  "pardon",
  "huh",
  "what",
]);

const DONT_KNOW_JAPANESE_PATTERNS = [
  "わからない",
  "わかんない",
  "分からない",
  "分かんない",
  "わかりません",
  "分かりません",
  "しらない",
  "知らない",
  "しりません",
  "知りません",
  "どういう意味",
  "どういういみ",
  "どういうこと",
  "日本語",
  "にほんご",
  "ヒント",
  "おしえて",
  "教えて",
  "むずかしい",
  "難しい",
] as const;

/**
 * 「I don't know」「わからない」などの発話を判定する。
 * 不正解にはせず、日本語の聞きなおしとヒントを出すために使う。
 */
export const isDontKnowAnswer = (answer: string): boolean => {
  const raw = answer.trim();
  if (!raw) return false;
  for (const jp of DONT_KNOW_JAPANESE_PATTERNS) {
    if (raw.includes(jp)) return true;
  }
  const normalized = normalizeEnglish(raw);
  if (!normalized) return false;
  if (DONT_KNOW_SINGLE_WORDS.has(normalized)) return true;
  return DONT_KNOW_ENGLISH_PHRASES.some((phrase) => containsPhrase(normalized, phrase));
};

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

/** キーワード群をすべて満たせば正解(音声認識の言いまわしの揺れを許す)。 */
export const judgeTalkAnswer = (turn: TalkTurn, answer: string): boolean => {
  if (isDontKnowAnswer(answer)) return false;
  const normalized = normalizeEnglish(answer);
  if (!normalized) return false;
  return turn.accept.every((group) => group.some((phrase) => containsPhrase(normalized, phrase)));
};

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
