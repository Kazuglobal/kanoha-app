import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 子ども向けの文言は ひらがな中心(CLAUDE.md)。えいごで おはなしの画面のコードに、
 * ルビなしの漢字(コメントを除く)が残っていないことを確かめる。
 */

const DIR = path.join(process.cwd(), "components", "child", "englishTalk");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** ブロックコメント・行コメント(JSX の {/* *\/} を含む)を取りのぞく。文字列の中の // は URL などで使わない前提。 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const KANJI = /[一-鿿々]+/g;

describe("えいごで おはなしの画面の文言", () => {
  const files = sourceFiles(DIR);

  it("検査の対象を見つけられている", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [path.relative(process.cwd(), file), file]))(
    "%s に ルビなしの漢字がない",
    (_name, file) => {
      const kanji = stripComments(readFileSync(file, "utf8")).match(KANJI) ?? [];
      expect(kanji).toEqual([]);
    },
  );
});
