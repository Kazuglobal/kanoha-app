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

/** キーワード群をすべて満たせば正解(音声認識の言いまわしの揺れを許す)。 */
export const judgeTalkAnswer = (turn: TalkTurn, answer: string): boolean => {
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
