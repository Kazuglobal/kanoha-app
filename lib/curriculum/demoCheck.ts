import { answersMatch } from "@/lib/utils/answers";
import { getCurriculumProblemById } from "./curriculumBank";
import { buildCurriculumPractice } from "./practice";

/**
 * 未ログイン(デモ)の答え合わせをサーバーで行うためのデータと判定(A2: 答えをクライアントへ渡さない)。
 * このモジュールはサーバー(Route Handler / Server Component)からだけ import すること。
 */

interface DemoPracticeItem {
  question: string;
  choices: readonly string[] | null;
  answer: string;
  explanation: string;
  listenText?: string;
}

const CURATED_VOLUME: readonly DemoPracticeItem[] = [
  { question: "2L は なんmL？", choices: ["200mL", "2000mL", "20mL", "1200mL"], answer: "2000mL", explanation: "1Lは1000mL。2こ分をかんがえよう。" },
  { question: "3000mL は なんL？", choices: ["3L", "30L", "300L", "1L"], answer: "3L", explanation: "1000mLがいくつあるか数えよう。" },
  { question: "1L と 500mL で ぜんぶで？", choices: ["1500mL", "600mL", "1050mL", "500mL"], answer: "1500mL", explanation: "1Lを1000mLになおしてたそう。" },
  { question: "4L は なんmL？", choices: ["400mL", "40mL", "4000mL", "1400mL"], answer: "4000mL", explanation: "1000mLが4こ分だよ。" },
  { question: "5000mL は なんL？", choices: ["50L", "5L", "500L", "2L"], answer: "5L", explanation: "1000mLずつに分けよう。" },
];

const CURATED_KANJI: readonly DemoPracticeItem[] = [
  { question: "「春風」の 読み方は？", choices: ["はるかぜ", "しゅんぷう", "あきかぜ", "はるあめ"], answer: "はるかぜ", explanation: "「春」と「風」で「はるかぜ」だよ。" },
  { question: "「青い」の 読み方は？", choices: ["あおい", "しろい", "くろい", "あかい"], answer: "あおい", explanation: "青い空の「あおい」だね。" },
  { question: "「青葉」の 読み方は？", choices: ["あおば", "あおは", "せいわ", "わかば"], answer: "あおば", explanation: "「青」と「葉」で「あおば」だよ。" },
  { question: "「大空」の 読み方は？", choices: ["おおぞら", "だいくう", "たいくう", "おおそら"], answer: "おおぞら", explanation: "大きな空のことで「おおぞら」と読むよ。" },
  { question: "「青空」の 読み方は？", choices: ["あおぞら", "あおそら", "せいくう", "あおぞう"], answer: "あおぞら", explanation: "「青空」は「あおぞら」と読むよ。" },
];

/** デモの最初の問題は、同じ考え方で 4/5 を目指せるよう厳選した練習セットを使う。 */
const CURATED_PRACTICE: Readonly<Record<string, readonly DemoPracticeItem[]>> = {
  "volume-1": CURATED_VOLUME,
  "kanji-1": CURATED_KANJI,
};

/** ルビ辞書カバレッジテスト用: デモ練習の子ども向け文言ぜんぶ。 */
export const DEMO_PRACTICE_STRINGS: readonly string[] = Object.values(CURATED_PRACTICE).flatMap((items) =>
  items.flatMap((item) => [item.question, ...(item.choices ?? []), item.explanation]),
);

const practiceItems = (bankId: string): readonly DemoPracticeItem[] =>
  CURATED_PRACTICE[bankId] ??
  buildCurriculumPractice(bankId).map((item) => ({
    question: item.question,
    choices: item.choices,
    answer: item.answer,
    explanation: item.explanation,
    ...(item.listenText ? { listenText: item.listenText } : {}),
  }));

const practiceCheckId = (bankId: string, index: number) => `demo:${bankId}:${index}`;

export interface DemoPracticeQuestion {
  question: string;
  choices: readonly string[] | null;
  listenText?: string;
  /** POST /api/demo/check に渡す照合 id(答えそのものは含まない) */
  checkId: string;
}

/** デモの「れんしゅう 5もん」(答えなし)。 */
export function demoPracticeFor(bankId: string): readonly DemoPracticeQuestion[] {
  return practiceItems(bankId).map((item, index) => ({
    question: item.question,
    choices: item.choices,
    ...(item.listenText ? { listenText: item.listenText } : {}),
    checkId: practiceCheckId(bankId, index),
  }));
}

export interface DemoCheckResult {
  correct: boolean;
  /** まちがえたときだけ返す解説 */
  explanation: string | null;
}

/** checkId(問題バンクの id か、デモ練習の id)の答え合わせ。未知の id は null。 */
export function checkDemoAnswer(checkId: string, answer: string): DemoCheckResult | null {
  const practice = checkId.match(/^demo:(.+):(\d+)$/);
  if (practice) {
    const item = practiceItems(practice[1])[Number(practice[2])];
    if (!item) return null;
    const correct = answersMatch(answer, item.answer);
    return { correct, explanation: correct ? null : item.explanation };
  }
  const bank = getCurriculumProblemById(checkId);
  if (!bank) return null;
  return { correct: answersMatch(answer, bank.correctAnswer), explanation: null };
}
