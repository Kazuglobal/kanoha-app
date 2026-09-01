import { RUBY_DICTIONARY } from "./rubyDictionary";

/** RubyText が受け取るパート型と互換(ここで再定義して循環依存を避ける)。 */
export type RubyPart = { text: string; ruby?: string };

/** 辞書キーを長い順に並べた不変リスト(最長一致のため一度だけ生成)。 */
const SORTED_KEYS: readonly string[] = Object.freeze(
  Object.keys(RUBY_DICTIONARY).sort((a, b) => b.length - a.length),
);

/** 位置 index から最長一致する辞書キーを返す(無ければ null)。 */
function matchAt(text: string, index: number): string | null {
  for (const key of SORTED_KEYS) {
    if (text.startsWith(key, index)) return key;
  }
  return null;
}

/**
 * 文字列を辞書で最長一致しながら走査し、RubyPart[] に変換する純粋関数。
 * 辞書に無い文字は連続したルビ無しパートとしてまとめる。
 */
export function toRubyParts(text: string): readonly RubyPart[] {
  const parts: RubyPart[] = [];
  let plain = "";
  let index = 0;

  while (index < text.length) {
    const key = matchAt(text, index);
    if (key) {
      if (plain) {
        parts.push({ text: plain });
        plain = "";
      }
      parts.push({ text: key, ruby: RUBY_DICTIONARY[key] });
      index += key.length;
    } else {
      plain += text[index];
      index += 1;
    }
  }
  if (plain) parts.push({ text: plain });
  return parts;
}

/** 漢字を読み(ひらがな)に置換した文字列を返す純粋関数。 */
export function toHiragana(text: string): string {
  return toRubyParts(text)
    .map((part) => part.ruby ?? part.text)
    .join("");
}
