import { toHiragana, toRubyParts } from "@/lib/curriculum/toRubyParts";

type RubyPart = { text: string; ruby?: string };

type ReadingMode = "kanji_with_ruby" | "hiragana";

/**
 * 子どもの reading_mode 設定に応じて文字列を表示する。
 * - kanji_with_ruby: 漢字にルビ(ふりがな)を付ける
 * - hiragana: 漢字を読み(ひらがな)に置換する
 * - excludeBrackets: 「」『』【】内の出題漢字をルビ対象から除外（読み問題で答えを明かさない）
 */
export function RubyAuto({
  text,
  readingMode,
  excludeBrackets = false,
}: {
  text: string;
  readingMode: ReadingMode;
  excludeBrackets?: boolean;
}) {
  if (readingMode === "hiragana") return <>{toHiragana(text, { excludeBrackets })}</>;
  return <RubyText parts={toRubyParts(text, { excludeBrackets })} />;
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
          <span key={`${part.text}-${index}`}>
            <LangAwareText text={part.text} />
          </span>
        ),
      )}
    </>
  );
}

/** 英単語・英文(2文字以上の英字のかたまり)。単位の mL などもふくむが、lang="en" で害はない。 */
const ENGLISH_RUN = /([A-Za-z][A-Za-z'.,!? ]*[A-Za-z.!?])/;

/** 英語の部分だけ lang="en" にして、読み上げ・スクリーンリーダーが英語で発音できるようにする。 */
function LangAwareText({ text }: { text: string }) {
  const pieces = text.split(ENGLISH_RUN);
  if (pieces.length === 1) return <>{text}</>;
  return (
    <>
      {pieces.map((piece, index) =>
        index % 2 === 1 ? (
          <span key={index} lang="en">
            {piece}
          </span>
        ) : (
          piece
        ),
      )}
    </>
  );
}

