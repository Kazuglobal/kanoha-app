import type { Difficulty } from "./schemas";

const privacyRule =
  "学校名、先生名、クラス名、本名、住所などの個人情報は出力に含めないでください。";

export const buildAnalyzeProblemsPrompt = (allowedUnits: readonly string[]): string =>
  [
    "あなたは小学2年生の算数学習を支援するAIです。",
    "画像から問題文、図、手書き回答、途中式、赤ペン、丸つけを読み取ってください。",
    privacyRule,
    `unitは次の一覧からだけ選んでください: ${allowedUnits.join(", ")}`,
    "問題ごとに分割し、指定されたJSON形式だけを出力してください。",
  ].join("\n");

export const buildHintsPrompt = (
  problemText: string,
  explanationLevel: "very_easy" | "easy" | "standard",
): string =>
  [
    "あなたは小学2年生向けの、ほめ上手な算数コーチです。",
    privacyRule,
    `問題: ${problemText}`,
    `説明レベル: ${explanationLevel}`,
    "答えを先に出さず、hint1、hint2、solution、answerの順で段階的に説明してください。",
    "やさしい短い文を使い、できている部分をpraiseで必ずほめてください。",
    "指定されたJSON形式だけを出力してください。",
  ].join("\n");

export const buildSimilarProblemsPrompt = (input: {
  difficulty: Difficulty;
  mistakeType?: string;
  problemText: string;
  subUnit: string;
  unit: string;
}): string =>
  [
    "あなたは小学2年生向け算数教材を作るAIです。",
    privacyRule,
    `元の問題: ${input.problemText}`,
    `単元: ${input.unit} / ${input.subUnit}`,
    `難しさ: ${input.difficulty}`,
    `改善したい間違え方: ${input.mistakeType ?? "指定なし"}`,
    "同じ考え方を練習できる類題をちょうど5問作ってください。",
    "各問に答えと短い解説を含め、指定されたJSON形式だけを出力してください。",
  ].join("\n");

export const buildHandwritingPrompt = (problemText: string): string =>
  [
    "あなたは小学2年生の算数の手書き回答を読み取るAIです。",
    privacyRule,
    `問題: ${problemText}`,
    "画像に書かれた数字・単位・ことばだけを読み取り、子どもが書いた答えをそのまま文字列にしてください。",
    "読み取れない場合でも、最も近いと思う答えを1つだけ出力してください。",
    "指定されたJSON形式だけを出力してください。",
  ].join("\n");

export const buildParentReportPrompt = (summary: string): string =>
  [
    "保護者向けに、簡潔で前向きな日次算数学習レポートを作ってください。",
    privacyRule,
    summary,
  ].join("\n");
