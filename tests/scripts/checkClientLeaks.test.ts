import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/** scripts/check-client-leaks.mjs を、作り物の .next と答えのソースを置いた一時フォルダで動かして確かめる。 */

const SCRIPT = path.join(process.cwd(), "scripts", "check-client-leaks.mjs");
const TMP_PREFIX = "kanoha-leaks-";
const created: string[] = [];

const BANK_SOURCE = `export const BANK = [{
  hints: { hint1: "ひみつのヒントのぶんしょうです", solution: "ひみつのときかたのぶんしょうです" },
}];\n`;

interface Fixture {
  bank?: boolean;
  chunk?: string | null;
  buildId?: boolean;
  /** BUILD_ID の更新時刻を、ソースの何秒あとにするか(負ならソースより古い) */
  buildOffsetSeconds?: number;
}

function setup({ bank = true, chunk = "console.log(1)", buildId = true, buildOffsetSeconds = 10 }: Fixture = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX));
  created.push(dir);
  const base = Date.now() / 1000 - 100;
  if (bank) {
    mkdirSync(path.join(dir, "lib", "curriculum"), { recursive: true });
    const source = path.join(dir, "lib", "curriculum", "curriculumBankFake.ts");
    writeFileSync(source, BANK_SOURCE);
    utimesSync(source, base, base);
  }
  mkdirSync(path.join(dir, ".next", "static", "chunks"), { recursive: true });
  if (chunk !== null) writeFileSync(path.join(dir, ".next", "static", "chunks", "a.js"), chunk);
  if (buildId) {
    const file = path.join(dir, ".next", "BUILD_ID");
    writeFileSync(file, "build");
    utimesSync(file, base + buildOffsetSeconds, base + buildOffsetSeconds);
  }
  return dir;
}

const run = (cwd: string) => {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

afterAll(() => {
  // このテストで作った一時フォルダだけを消す(場所と名前を確かめてから)
  for (const dir of created) {
    if (dir.startsWith(os.tmpdir()) && path.basename(dir).startsWith(TMP_PREFIX)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("check-client-leaks", () => {
  it("答えが入っていないビルドは OK(終了コード 0)", () => {
    const result = run(setup());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("ヒントの文そのものが静的 JS に入っていたら失敗する(終了コード 1)", () => {
    const result = run(setup({ chunk: 'x.push({h:"ひみつのヒントのぶんしょうです"})' }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("a.js");
    expect(result.stderr).toContain("ひみつのヒントのぶんしょうです");
  });

  it("correctAnswer:\"…\" の書き方が入っていたら失敗する", () => {
    const result = run(setup({ chunk: 'x={id:"a",correctAnswer:"1000mL"}' }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("correctAnswer");
  });

  it("デモの answer:\"…\",explanation:\"…\" の並びが入っていたら失敗する(短い答えでも見つける)", () => {
    const result = run(setup({ chunk: 'x=[{question:"2L は なんmL？",answer:"2000mL",explanation:"1Lは1000mL。"}]' }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("answer");
  });

  it("property の読み取り(result.correctAnswer)は漏えいとして扱わない", () => {
    const result = run(setup({ chunk: "if(r.correctAnswer){go(r.correctAnswer)}" }));
    expect(result.status).toBe(0);
  });

  it(".next/static が無いときは、先にビルドするよう伝えて終了コード 2", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX));
    created.push(dir);
    const result = run(dir);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("npm run build");
  });

  it("JS が 1 つもないビルドは、OK にせず終了コード 2", () => {
    const result = run(setup({ chunk: null }));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("JS");
  });

  it("答えのソースから検査用の文を集められないときは終了コード 2", () => {
    const result = run(setup({ bank: false }));
    expect(result.status).toBe(2);
  });

  it("ビルドのあとにソースが変わっていたら、古いビルドを検査しないよう終了コード 2", () => {
    const result = run(setup({ buildOffsetSeconds: -50 }));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("ビルド");
  });
});
