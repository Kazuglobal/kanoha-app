import path from "node:path";

/**
 * クライアント/サーバー境界の静的検査(ソースの文字列だけを読む。Vitest は "use client" の境界を再現しないため)。
 * 1. answerLeaks   : "use client" のファイルから(共通モジュールを経由しても)答えのモジュールに届く import
 * 2. clientCalls   : サーバー側(入口と、そこから辿れるサーバーのファイル)が、"use client" のファイルから
 *                    コンポーネント以外(関数・定数)を import している → 実行時に「サーバーから呼べない」で落ちる
 * 3. missingServerOnly : 答えのモジュールに `import "server-only"` が無い
 */

export interface BoundaryOptions {
  /** 答えを持つモジュール(拡張子なしのリポジトリ相対パス) */
  answerModules: readonly RegExp[];
  /** サーバー側の入口(Next が直接呼ぶファイル。拡張子つきのパス) */
  serverEntry: RegExp;
}

export interface BoundaryReport {
  answerLeaks: string[];
  clientCalls: string[];
  missingServerOnly: string[];
  counts: { files: number; client: number; serverEntries: number };
}

interface Ref {
  index: number;
  spec: string;
  names: string[];
  defaultName: string | null;
  namespace: boolean;
}

interface Edge {
  ref: Ref;
  /** 拡張子なしのリポジトリ相対パス(パッケージや解決できない指定は null) */
  key: string | null;
  /** 集めたファイルの中にあれば、そのパス */
  target: string | null;
}

const IMPORT_FROM =
  /import\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)\s+from\s+["']([^"']+)["']/g;
const EXPORT_FROM = /export\s+(type\s+)?(\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const SIDE_EFFECT_IMPORT = /^\s*import\s+["']([^"']+)["']/gm;
const SERVER_ONLY_IMPORT = /^\s*import\s+["']server-only["']/m;
const SOURCE_EXT = /\.(?:tsx?|jsx?|mjs)$/;

const toKey = (file: string) => file.replace(SOURCE_EXT, "").replace(/\/index$/, "");

const stripLeadingComments = (source: string) =>
  source.replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)+/, "");

const isClientSource = (source: string) => /^["']use client["']/.test(stripLeadingComments(source));

/** React のコンポーネント名(先頭が大文字で小文字も含む。SCENE_THEMES のような定数は除く)。 */
export const isComponentName = (name: string) => /^[A-Z]/.test(name) && /[a-z]/.test(name);

const specifierNames = (braces: string) =>
  braces
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("type "))
    .map((item) => item.split(/\s+as\s+/)[0].trim());

function parseFromClauses(source: string, pattern: RegExp): Ref[] {
  return [...source.matchAll(pattern)].flatMap((match) => {
    const [, type, clause, spec] = match;
    if (type) return [];
    const braces = /\{([^}]*)\}/.exec(clause)?.[1];
    const names = braces === undefined ? [] : specifierNames(braces);
    const namespace = /\*/.test(clause);
    const defaultName = /^[A-Za-z_$][\w$]*/.exec(clause)?.[0] ?? null;
    if (names.length === 0 && !defaultName && !namespace) return []; // 型だけの指定
    return [{ index: match.index ?? 0, spec, names, defaultName, namespace }];
  });
}

function parseRefs(source: string): Ref[] {
  const bare = (pattern: RegExp): Ref[] =>
    [...source.matchAll(pattern)].map((match) => ({
      index: match.index ?? 0,
      spec: match[1],
      names: [],
      defaultName: null,
      namespace: false,
    }));
  return [
    ...parseFromClauses(source, IMPORT_FROM),
    ...parseFromClauses(source, EXPORT_FROM),
    ...bare(DYNAMIC_IMPORT),
    ...bare(SIDE_EFFECT_IMPORT),
  ].sort((a, b) => a.index - b.index);
}

function resolveKey(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) return toKey(path.posix.normalize(spec.slice(2)));
  if (spec.startsWith(".")) return toKey(path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec)));
  return null;
}

function buildGraph(files: ReadonlyMap<string, string>): Map<string, Edge[]> {
  const fileByKey = new Map([...files.keys()].map((file) => [toKey(file), file]));
  return new Map(
    [...files].map(([file, source]) => [
      file,
      parseRefs(source).map((ref) => {
        const key = resolveKey(file, ref.spec);
        return { ref, key, target: key === null ? null : (fileByKey.get(key) ?? null) };
      }),
    ]),
  );
}

function findAnswerLeaks(
  graph: ReadonlyMap<string, Edge[]>,
  clientFiles: readonly string[],
  isAnswerKey: (key: string) => boolean,
): string[] {
  const leaks = new Set<string>();
  for (const start of clientFiles) {
    const visited = new Set([start]);
    const queue: string[][] = [[start]];
    for (let chain = queue.shift(); chain; chain = queue.shift()) {
      for (const edge of graph.get(chain[chain.length - 1]) ?? []) {
        if (edge.key !== null && isAnswerKey(edge.key)) {
          leaks.add([...chain.map((file, i) => (i === 0 ? file : toKey(file))), edge.key].join(" -> "));
        } else if (edge.target && !visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push([...chain, edge.target]);
        }
      }
    }
  }
  return [...leaks].sort();
}

function describeClientCalls(file: string, { ref }: Edge): string[] {
  return [
    ...(ref.namespace ? [`${file}: * from ${ref.spec}`] : []),
    ...ref.names.filter((name) => !isComponentName(name)).map((name) => `${file}: ${name} from ${ref.spec}`),
    ...(ref.defaultName && !isComponentName(ref.defaultName)
      ? [`${file}: default ${ref.defaultName} from ${ref.spec}`]
      : []),
  ];
}

function findClientCalls(
  graph: ReadonlyMap<string, Edge[]>,
  roots: readonly string[],
  clientSet: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  const visited = new Set(roots);
  const queue = [...roots];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const edge of graph.get(file) ?? []) {
      if (!edge.target) continue;
      if (clientSet.has(edge.target)) violations.push(...describeClientCalls(file, edge));
      else if (!visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return [...new Set(violations)];
}

export function scanBoundary(files: ReadonlyMap<string, string>, options: BoundaryOptions): BoundaryReport {
  const graph = buildGraph(files);
  const clientFiles = [...files].filter(([, source]) => isClientSource(source)).map(([file]) => file);
  const clientSet = new Set(clientFiles);
  const roots = [...files.keys()].filter((file) => options.serverEntry.test(file) && !clientSet.has(file));
  const isAnswerKey = (key: string) => options.answerModules.some((pattern) => pattern.test(key));

  return {
    answerLeaks: findAnswerLeaks(graph, clientFiles, isAnswerKey),
    clientCalls: findClientCalls(graph, roots, clientSet),
    missingServerOnly: [...files]
      .filter(([file, source]) => isAnswerKey(toKey(file)) && !SERVER_ONLY_IMPORT.test(source))
      .map(([file]) => file)
      .sort(),
    counts: { files: files.size, client: clientFiles.length, serverEntries: roots.length },
  };
}
