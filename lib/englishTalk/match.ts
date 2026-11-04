import { canonicalize, normalizeEnglish, tokenize } from "./normalize";

/**
 * 発話(トークン列)が、そのターンの accept(言い方のキーワード)に合っているかの判定。
 * accept は「グループの AND、グループの中は OR」。語句は連続したトークンとして探す。
 * 発話も語句も、数字は英単語に・縮めた言い方はひらいた形にそろえてから比べる(canonicalize)。
 */

/** 英語の音声認識がよく取りちがえる似た音。短い答えのときだけ使う(長い文の中の偶然の一致を拾わないため)。 */
const PHONETIC_ALIASES: Readonly<Record<string, readonly string[]>> = {
  one: ["won"],
  two: ["to", "too", "tu"],
  three: ["tree", "free", "sri", "thee"],
  four: ["for", "fore"],
  eight: ["ate"],
  dog: ["dock", "dug", "dawg", "dogs"],
  red: ["read", "led"],
  fine: ["find", "vine", "pine"],
  pencil: ["cancel", "pencils"],
  elephant: ["eleven", "element", "elephants"],
  morning: ["warning"],
  thank: ["tank", "sank"],
  bye: ["buy", "by"],
  goodbye: ["good bye", "good by", "bye bye", "byebye"],
  lets: ["let us"],
};

/** 別名で判定するとき、あってもなくてもよい つなぎの語(ひらいた形: I am / it is)。 */
const FILLERS = new Set([
  "i", "am", "it", "is", "a", "an", "the", "this", "that", "please", "um", "uh", "umm", "hmm", "well", "oh", "and",
]);

/** 別名で判定してよい、つなぎの語を除いた長さの上限。 */
const MAX_ALIAS_CORE_TOKENS = 3;

type Sequence = readonly string[];

/** 語句 → そろえたトークン列。 */
export const phraseTokens = (phrase: string): Sequence => canonicalize(tokenize(normalizeEnglish(phrase)));

/** つなぎの語を除いた、中身のトークン。 */
export const coreTokens = (tokens: readonly string[]): string[] => tokens.filter((token) => !FILLERS.has(token));

/** トークン列の中に、その語句が連続して入っているか。 */
export const containsPhrase = (tokens: readonly string[], phrase: Sequence): boolean =>
  phrase.length > 0 && tokens.some((_, start) => phrase.every((word, offset) => tokens[start + offset] === word));

/** 語句そのものと、その中の1語を似た音に置きかえたもの。 */
const phraseVariants = (phrase: Sequence): Sequence[] => [
  phrase,
  ...phrase.flatMap((word, index) =>
    (PHONETIC_ALIASES[word] ?? []).map((alias) => [
      ...phrase.slice(0, index),
      ...phraseTokens(alias),
      ...phrase.slice(index + 1),
    ]),
  ),
];

/**
 * accept(グループの AND、グループの中は OR)に合っているか。tokens は canonicalize ずみ。
 * extraAllowed: 別名で判定するとき、accept のほかに言ってよい語(お手本の答えや問いの言葉。「Good warning」「Tree apples」のため)。
 */
export function matchesAccept(
  accept: readonly (readonly string[])[],
  tokens: readonly string[],
  extraAllowed: readonly string[] = [],
): boolean {
  const groups = accept.map((group) => group.map(phraseTokens));
  if (groups.every((group) => group.some((sequence) => containsPhrase(tokens, sequence)))) return true;

  const core = coreTokens(tokens);
  if (core.length === 0 || core.length > MAX_ALIAS_CORE_TOKENS) return false;
  const variants = groups.map((group) => group.flatMap(phraseVariants));
  const allowed = new Set([...variants.flat(2), ...extraAllowed]);
  return (
    core.every((token) => allowed.has(token)) &&
    variants.every((group) => group.some((sequence) => containsPhrase(tokens, sequence)))
  );
}

/** 複数形をそろえる(apples → apple、peaches → peach、strawberries → strawberry)。短い語はそのまま。 */
function stem(word: string): string {
  if (word.length < 4) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(?:ch|sh|x|ss|z|o)es$/.test(word)) return word.slice(0, -2);
  return word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/**
 * まねして言うとき、お手本の語がどれだけ入っているか(0〜1)。tokens は canonicalize ずみ。
 * 複数形のちがい・似た音の別名(2語の「good bye」も)も同じ語として数える。
 */
export function modelOverlap(modelAnswer: string, tokens: readonly string[]): number {
  const model = phraseTokens(modelAnswer);
  if (model.length === 0) return 1;
  const spokenStems = new Set(tokens.map(stem));
  const hits = model.filter(
    (word) =>
      spokenStems.has(stem(word)) ||
      (PHONETIC_ALIASES[word] ?? []).some((alias) => containsPhrase(tokens, phraseTokens(alias))),
  );
  return hits.length / model.length;
}
