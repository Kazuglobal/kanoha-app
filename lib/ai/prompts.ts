import type { Difficulty } from "./schemas";
import { SUBJECTS, type Subject } from "@/lib/curriculum/subjects";

const privacyRule =
  "学校名、先生名、クラス名、本名、住所などの個人情報は出力に含めないでください。";

/** 教科ごとのプロンプト部品(教科分岐はここに集約する)。 */
const SUBJECT_PROMPTS: Readonly<
  Record<Subject, { analyzeRole: string; coach: string; coachFocus: string; material: string; handwriting: string; handwritingTarget: string }>
> = {
  math: {
    analyzeRole: "あなたは小学2年生の算数学習を支援するAIです。",
    coach: "あなたは小学2年生向けの、ほめ上手な算数コーチです。",
    coachFocus:
      "hint1やhint2では、子どもが頭の中で図や絵（マス目、おはじき、コップ、テープの長さなど）を思い浮かべられるように、図解のように具体的でわかりやすい言葉を使って説明してください（例: 『□を10こ あつめると…』『コップ何ばい分かな？』）。",
    material: "あなたは小学2年生向け算数教材を作るAIです。",
    handwriting: "あなたは小学2年生の算数の手書き回答を読み取るAIです。",
    handwritingTarget: "画像に書かれた数字・単位・ことばだけを読み取り、子どもが書いた答えをそのまま文字列にしてください。",
  },
  japanese: {
    analyzeRole: "あなたは小学2年生の国語学習を支援するAIです。",
    coach: "あなたは小学2年生向けの、ほめ上手なこくごコーチです。",
    coachFocus:
      "hint1やhint2では、子どもが自分で気づけるように、問いの注目点や文中の手がかり（例: 『文の中の〜という言葉の近くを探してみよう』『だれが言った言葉かな？』『漢字の形や部分に注目してみよう』など）をやさしい言葉で具体的に説明してください。",
    material: "あなたは小学2年生向け国語教材を作るAIです。",
    handwriting: "あなたは小学2年生の国語の手書き回答を読み取るAIです。",
    handwritingTarget:
      "画像に書かれた文字（ひらがな、カタカナ、漢字、ことば）を丁寧に読み取り、子どもが書いた答えをそのまま文字列にしてください。",
  },
  english: {
    analyzeRole: "あなたは小学2年生が英語に親しむ学習を支援するAIです。",
    coach: "あなたは小学2年生向けの、ほめ上手なえいごコーチです。",
    coachFocus:
      "hint1やhint2では、音・最初の文字・身近なもののイメージ（例: 『さいしょの おとは「エー」だよ』『あかい くだものを おもいうかべてね』）を手がかりに、ひらがな中心のやさしい日本語で説明してください。英単語は英語のつづりのまま書き、カタカナの読みがなは付けないでください。",
    material:
      "あなたは小学2年生向けの英語教材を作るAIです。書かせる問題ではなく、聞いたり見たりして選べる問題にしてください。問題文はひらがな中心の日本語、英単語は英語のつづりで書いてください。",
    handwriting: "あなたは小学2年生の英語（アルファベット）の手書き回答を読み取るAIです。",
    handwritingTarget: "画像に書かれたアルファベットや英単語を読み取り、大文字・小文字を区別してそのまま文字列にしてください。",
  },
};

export const buildAnalyzeProblemsPrompt = (
  allowedUnits: readonly string[],
  subjectHint?: Subject,
): string => {
  const roleText = subjectHint
    ? SUBJECT_PROMPTS[subjectHint].analyzeRole
    : `あなたは小学2年生の算数・国語・英語の学習を支援するAIです。画像から教科を判定し、subjectに${SUBJECTS.map((subject) => `'${subject}'`).join("、")}のいずれかを設定してください。`;

  return [
    roleText,
    "画像から問題文、図、手書き回答、途中式、赤ペン、丸つけを読み取ってください。",
    privacyRule,
    `unitは次の一覧からだけ選んでください: ${allowedUnits.join(", ")}`,
    "問題ごとに分割し、指定されたJSON形式だけを出力してください。",
  ].join("\n");
};

export const buildHintsPrompt = (
  problemText: string,
  explanationLevel: "very_easy" | "easy" | "standard",
  subject: Subject = "math",
): string =>
  [
    SUBJECT_PROMPTS[subject].coach,
    privacyRule,
    `問題: ${problemText}`,
    `説明レベル: ${explanationLevel}`,
    "答えを先に出さず、hint1、hint2、solution、answerの順で段階的に説明してください。",
    SUBJECT_PROMPTS[subject].coachFocus,
    "やさしい短い文を使い、考えようとしたことや気づけた部分をpraiseで必ずほめてください。",
    "指定されたJSON形式だけを出力してください。",
  ].join("\n");

export const buildSimilarProblemsPrompt = (input: {
  difficulty: Difficulty;
  mistakeType?: string;
  problemText: string;
  subUnit: string;
  unit: string;
  subject?: Subject;
}): string =>
  [
    SUBJECT_PROMPTS[input.subject ?? "math"].material,
    privacyRule,
    `元の問題: ${input.problemText}`,
    `単元: ${input.unit} / ${input.subUnit}`,
    `難しさ: ${input.difficulty}`,
    `改善したい間違え方: ${input.mistakeType ?? "指定なし"}`,
    "同じ考え方を練習できる類題をちょうど5問作ってください。",
    "各問に答えと短い解説を含め、指定されたJSON形式だけを出力してください。",
  ].join("\n");

export const buildHandwritingPrompt = (
  problemText: string,
  subject: Subject = "math",
): string => [
  SUBJECT_PROMPTS[subject].handwriting,
  privacyRule,
  `問題: ${problemText}`,
  SUBJECT_PROMPTS[subject].handwritingTarget,
  "読み取れない場合でも、最も近いと思う答えを1つだけ出力してください。",
  "指定されたJSON形式だけを出力してください。",
].join("\n");

export const buildVisualImagePrompt = (problemText: string, unit: string): string =>
  [
    "小学2年生向けの学習図解イラストを1枚作ってください。",
    privacyRule,
    `単元: ${unit}`,
    `問題: ${problemText}`,
    "やさしい色のフラットな図で、考え方が伝わるように描いてください。文字は最小限にします。",
    "答えそのものは絵に書き込まないでください。",
  ].join("\n");

export const buildParentReportPrompt = (summary: string): string =>
  [
    "保護者向けに、簡潔で前向きな日次学習レポートを作ってください。",
    privacyRule,
    summary,
  ].join("\n");
