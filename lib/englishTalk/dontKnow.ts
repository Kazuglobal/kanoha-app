import { normalizeEnglish } from "./normalize";

/**
 * 「I don't know」「わからない」などの発話を見つける。
 * 不正解にはせず、日本語の聞きなおしとヒントを出すために使う(クライアントとサーバーの両方で使う)。
 */

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

const DONT_KNOW_SINGLE_WORDS = new Set(["help", "hint", "japanese", "pardon", "huh", "what"]);

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

const hasJapanesePattern = (raw: string): boolean => DONT_KNOW_JAPANESE_PATTERNS.some((pattern) => raw.includes(pattern));

const hasEnglishPhrase = (normalized: string): boolean =>
  DONT_KNOW_ENGLISH_PHRASES.some((phrase) => ` ${normalized} `.includes(` ${phrase} `));

export const isDontKnowAnswer = (answer: string): boolean => {
  const raw = answer.trim();
  if (!raw) return false;
  if (hasJapanesePattern(raw)) return true;
  const normalized = normalizeEnglish(raw);
  if (!normalized) return false;
  return DONT_KNOW_SINGLE_WORDS.has(normalized) || hasEnglishPhrase(normalized);
};

/**
 * はっきりした「わからない」。単語ひとつ(what・huh・help)は、聞き取りの候補にたまたま混じることがあるので入れない。
 * 聞き取りの候補の中から「わからない」を選ぶときに使う(選ぶと ヘルプとして ★ が下がるため)。
 */
export const isExplicitDontKnow = (answer: string): boolean => {
  const raw = answer.trim();
  return Boolean(raw) && (hasJapanesePattern(raw) || hasEnglishPhrase(normalizeEnglish(raw)));
};
