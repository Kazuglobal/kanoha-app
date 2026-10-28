import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanBoundary, type BoundaryOptions } from "./boundaryScan";

/**
 * このリポジトリのクライアント/サーバー境界の検査(検査のしくみ自体は boundaryScan.test.ts)。
 * - 答え(正解・模範解答)を持つモジュールが、ブラウザへ配る JS に入らない(CLAUDE.md「答えはクライアントへ渡さない」)
 * - サーバー側が "use client" のファイルから関数・定数を import しない(実行時に「サーバーから呼べない」で落ちる)
 */

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"] as const;
const ROOT_FILES = ["proxy.ts", "instrumentation.ts"] as const;

const OPTIONS: BoundaryOptions = {
  answerModules: [
    /^lib\/curriculum\/curriculumBank[A-Za-z0-9]*$/,
    /^lib\/curriculum\/englishTalkScenes$/,
    /^lib\/curriculum\/demoCheck$/,
    /^lib\/curriculum\/practice$/,
  ],
  serverEntry: new RegExp(
    "^app/(?:.*/)?(?:page|layout|template|loading|not-found|default|route|sitemap|robots|manifest|" +
      "opengraph-image|twitter-image|icon|apple-icon)\\.tsx?$|^(?:proxy|instrumentation)\\.ts$",
  ),
};

function listSourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : listSourceFiles(relative);
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

const exists = (file: string) => {
  try {
    return statSync(path.join(ROOT, file)).isFile();
  } catch {
    return false;
  }
};

const paths = [...SOURCE_DIRS.flatMap(listSourceFiles), ...ROOT_FILES.filter(exists)];
const report = scanBoundary(
  new Map(paths.map((file) => [file, readFileSync(path.join(ROOT, file), "utf8")])),
  OPTIONS,
);

describe("client / server boundary", () => {
  it("検査の対象を見つけられている(空振りしない)", () => {
    expect(report.counts.client).toBeGreaterThan(10);
    expect(report.counts.serverEntries).toBeGreaterThan(10);
  });

  it('"use client" のファイルは、(共通モジュールを経由しても)答えを持つモジュールに届かない', () => {
    expect(report.answerLeaks).toEqual([]);
  });

  it("答えを持つモジュールには、すべて import 'server-only' がある", () => {
    expect(report.missingServerOnly).toEqual([]);
  });

  it('サーバー側は、"use client" のファイルからコンポーネント以外を import しない', () => {
    expect(report.clientCalls).toEqual([]);
  });
});
