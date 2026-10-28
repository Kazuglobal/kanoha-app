/**
 * ビルド後の `.next/static`(ブラウザへ配る JS)に、答えが入っていないことを確かめる。
 * 使い方: `npm run build` のあとに `npm run check:leaks`。見つかったら終了コード 1、検査できなければ 2。
 *
 * 見つけるもの:
 * 1. 答えのデータの書き方(`correctAnswer:"…"` / `modelAnswer:"…"` / `accept:[[…` / `answer:"…",explanation:"…"`)。
 *    `result.correctAnswer` のようなプロパティの読み取りは対象にしない。
 * 2. 答えのデータを持つソースから集めた、ヒント・解き方・お手本・解説の文(8 文字以上)そのもの。
 *    教科ごとの固定ヒントのように、わざとクライアントへ渡している文は答えのソースに無いので誤検知しない。
 *
 * 見ないもの: ページの HTML や RSC に入る答え(静的 JS ではない)。それは e2e の `expectHidden` と
 * API のテストで確かめる。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, ".next");
const STATIC_DIR = path.join(NEXT_DIR, "static");
const BUILD_ID_FILE = path.join(NEXT_DIR, "BUILD_ID");

/** 答えのデータを持つソース(リポジトリ相対のディレクトリと、ファイル名の条件)。無いディレクトリは飛ばす。 */
const ANSWER_SOURCES = [
  { dir: "lib/curriculum", name: /^(curriculumBank[A-Za-z0-9]*|englishTalkScenes|demoCheck)\.ts$/ },
  { dir: "lib/generation", name: /\.ts$/ },
];
/** ビルドより新しい変更がないかを見るソースの置き場所。 */
const SOURCE_DIRS = ["app", "components", "lib"];
const CANARY_KEYS = ["hint1", "hint2", "solution", "explanation", "modelAnswer", "modelAnswerJa", "feedbackEn"];
const MIN_CANARY_LENGTH = 8;

const SHAPE_PATTERNS = [
  { name: "問題バンクの正解 (correctAnswer: 文字列)", pattern: /correctAnswer:\s*["'`][^"'`]/ },
  { name: "英会話のお手本の答え (modelAnswer: 文字列)", pattern: /modelAnswer(?:Ja)?:\s*["'`][^"'`]/ },
  { name: "英会話の判定キー (accept: [[…)", pattern: /accept:\s*\[\s*\[/ },
  {
    name: "デモの答えと解説 (answer: 文字列, explanation: 文字列)",
    pattern: /answer:\s*["'`][^"'`]+["'`]\s*,\s*explanation:\s*["'`]/,
  },
];

const CONTEXT_LENGTH = 60;
const MAX_CANARY_REPORTS_PER_FILE = 3;

const fail = (code, message) => {
  process.stderr.write(`${message}\n`);
  process.exit(code);
};

function* walk(dir, accept) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") yield* walk(full, accept);
    } else if (accept(entry.name)) yield full;
  }
}

function collectCanaries() {
  const keys = CANARY_KEYS.join("|");
  const pattern = new RegExp(`\\b(?:${keys})\\s*:\\s*"([^"\\\\\\n]+)"`, "g");
  const canaries = new Set();
  for (const { dir, name } of ANSWER_SOURCES) {
    const full = path.join(ROOT, dir);
    if (!existsSync(full)) continue;
    for (const file of walk(full, (fileName) => name.test(fileName))) {
      for (const [, text] of readFileSync(file, "utf8").matchAll(pattern)) {
        if (text.length >= MIN_CANARY_LENGTH) canaries.add(text);
      }
    }
  }
  return [...canaries];
}

/** ビルド(BUILD_ID)より新しく変わったソースがあれば、そのファイル名。古いビルドを検査しないための確認。 */
function newestSourceChangedAfterBuild() {
  const builtAt = statSync(BUILD_ID_FILE).mtimeMs;
  for (const dir of SOURCE_DIRS) {
    const full = path.join(ROOT, dir);
    if (!existsSync(full)) continue;
    for (const file of walk(full, (name) => /\.(?:tsx?|mjs|css)$/.test(name))) {
      if (statSync(file).mtimeMs > builtAt) return path.relative(ROOT, file);
    }
  }
  return null;
}

function findLeaks(file, canaries) {
  const source = readFileSync(file, "utf8");
  const relative = path.relative(ROOT, file);
  const shapes = SHAPE_PATTERNS.flatMap(({ name, pattern }) => {
    const match = pattern.exec(source);
    if (!match) return [];
    const snippet = source.slice(match.index, match.index + CONTEXT_LENGTH).replace(/\s+/g, " ");
    return [{ file: relative, name, snippet }];
  });
  const found = canaries
    .filter((text) => source.includes(text))
    .slice(0, MAX_CANARY_REPORTS_PER_FILE)
    .map((text) => ({ file: relative, name: "答えのソースにある文", snippet: text }));
  return [...shapes, ...found];
}

if (!existsSync(STATIC_DIR)) fail(2, ".next/static がありません。先に npm run build を実行してください。");
if (!existsSync(BUILD_ID_FILE)) fail(2, ".next/BUILD_ID がありません。ビルドが終わっていません。npm run build をやり直してください。");

const changed = newestSourceChangedAfterBuild();
if (changed) fail(2, `ビルドのあとに ${changed} が変わっています。古いビルドは検査できないので、npm run build をやり直してください。`);

const canaries = collectCanaries();
if (canaries.length === 0) fail(2, "答えのソースから検査用の文を集められませんでした。ANSWER_SOURCES を確認してください。");

const chunks = [...walk(STATIC_DIR, (name) => name.endsWith(".js"))];
if (chunks.length === 0) fail(2, ".next/static に JS が 1 つもありません。ビルドが途中で止まった可能性があります。");

const leaks = chunks.flatMap((file) => findLeaks(file, canaries));

if (leaks.length > 0) {
  process.stderr.write(`ブラウザ向けの JS に答えが入っています (${leaks.length} 件):\n`);
  for (const { file, name, snippet } of leaks) {
    process.stderr.write(`  ${file}\n    ${name}: ${snippet}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `OK: 静的 JS ${chunks.length} 件に答えのデータはありません (検査用の文 ${canaries.length} 件)。` +
    "ページの HTML に入る答えは e2e の expectHidden で確認します。\n",
);
