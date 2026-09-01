import { toHiragana, toRubyParts } from "@/lib/curriculum/toRubyParts";

type RubyPart = { text: string; ruby?: string };

type ReadingMode = "kanji_with_ruby" | "hiragana";

/**
 * 子どもの reading_mode 設定に応じて文字列を表示する。
 * - kanji_with_ruby: 漢字にルビ(ふりがな)を付ける
 * - hiragana: 漢字を読み(ひらがな)に置換する
 */
export function RubyAuto({ text, readingMode }: { text: string; readingMode: ReadingMode }) {
  if (readingMode === "hiragana") return <>{toHiragana(text)}</>;
  return <RubyText parts={toRubyParts(text)} />;
}

export function RubyText({ parts }: { parts: readonly RubyPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.ruby ? (
          <ruby key={`${part.text}-${index}`}>
            {part.text}
            <rp>(</rp>
            <rt>{part.ruby}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

