import type { Hints, ParsedProblem, SimilarProblemDraft } from "./schemas";

/**
 * 保存禁止のPII(学校名・先生名・クラス名・氏名・住所)を伏せ字にする純関数(B12)。
 * Zod 検証の「後」、DB insert の「前」に必ず適用する。プロンプト側の抑止(prompts.ts)だけに
 * 頼らない二重防御。『2年生』のような学年表記はクラス表記(『2年3組』)ではないので伏せない。
 */
const REPLACEMENT = "〇〇";

const PII_PATTERNS: readonly RegExp[] = [
  /[^\s、。]{1,10}(?:小学校|小|中学校)/g,
  /[^\s、。]{1,6}先生/g,
  /\d年\d組|\d組/g,
  /(?:なまえ|名前|氏名)[:：]\s*\S+/g,
  /[^\s、。]{1,4}[都道府県][^\s、。]{1,8}[市区町村]/g,
];

export const scrubPii = (text: string): string =>
  PII_PATTERNS.reduce((current, pattern) => current.replace(pattern, REPLACEMENT), text);

export const scrubPiiFromHints = (hints: Hints): Hints => ({
  answer: hints.answer,
  hint1: scrubPii(hints.hint1),
  hint2: scrubPii(hints.hint2),
  praise: scrubPii(hints.praise),
  solution: scrubPii(hints.solution),
});

/** 答え(correctAnswer 等)は正誤判定に使うため伏せ字にしない。 */
export const scrubPiiFromProblem = (problem: ParsedProblem): ParsedProblem => ({
  ...problem,
  hints: scrubPiiFromHints(problem.hints),
  mistakeReason:
    problem.mistakeReason === undefined ? undefined : scrubPii(problem.mistakeReason),
  problemText: scrubPii(problem.problemText),
});

export const scrubPiiFromSimilarProblem = (draft: SimilarProblemDraft): SimilarProblemDraft => ({
  ...draft,
  explanation: scrubPii(draft.explanation),
  problemText: scrubPii(draft.problemText),
});
