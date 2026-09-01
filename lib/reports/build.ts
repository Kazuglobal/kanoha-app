import type { buildDashboard } from "@/lib/reports/dashboard";

export type DashboardReport = ReturnType<typeof buildDashboard>;

/** parent_reports 行の内容(DB カラム名に合わせる)。 */
export interface ParentReportContent {
  summary: string;
  accuracy_rate: number;
  weak_units: readonly string[];
  growth_points: readonly string[];
  next_recommendations: readonly string[];
}

const NO_MISTAKE_TENDENCY = "まだ傾向はありません";

const percent = (rate: number) => Math.round(rate * 100);

const weakUnitLabels = (dashboard: DashboardReport): readonly string[] =>
  dashboard.weaknesses.map((weakness) =>
    [weakness.unit, weakness.sub_unit].filter(Boolean).join("・"),
  );

const masteredTodayUnits = (dashboard: DashboardReport): readonly string[] => [
  ...new Set(
    dashboard.todayAttempts
      .filter((attempt) => attempt.isCorrect && attempt.unit)
      .map((attempt) => attempt.unit),
  ),
];

const buildSummary = (dashboard: DashboardReport): string => {
  if (dashboard.todayQuestionCount === 0) {
    return "今日はゆっくり休めました。また明日、少しずつ進めていきましょう。";
  }
  if (dashboard.accuracyRate >= 0.8) {
    return "最後まであきらめずに考えられました。とても良い学習でした。";
  }
  return "むずかしい問題にも一生けんめい取り組めました。この調子で続けていきましょう。";
};

const buildGrowthPoints = (dashboard: DashboardReport): readonly string[] => [
  `今週の正答率は${percent(dashboard.growth.currentAccuracy)}%です`,
  ...(dashboard.growth.masteredUnits > 0
    ? [`できるようになった単元が${dashboard.growth.masteredUnits}個あります`]
    : []),
  ...(dashboard.streakDays >= 2 ? [`${dashboard.streakDays}日つづけて学習しています`] : []),
];

const buildRecommendations = (
  dashboard: DashboardReport,
  weakUnits: readonly string[],
): readonly string[] => {
  if (dashboard.dueReview) {
    return [`${dashboard.dueReview.date}に「${dashboard.dueReview.label}」の復習を1問入れます。`];
  }
  if (weakUnits.length > 0) {
    return [`次は「${weakUnits[0]}」の復習を少しずつ進めましょう。`];
  }
  return ["今日の調子で、新しい問題にも挑戦してみましょう。"];
};

/** doc.md §6.4 の8項目を buildDashboard の集計から組み立てる(B5)。否定しない文言のみ。 */
export function buildParentReport(dashboard: DashboardReport): ParentReportContent {
  const weakUnits = weakUnitLabels(dashboard);
  return {
    summary: buildSummary(dashboard),
    accuracy_rate: Math.round(dashboard.accuracyRate * 10_000) / 10_000,
    weak_units: weakUnits,
    growth_points: buildGrowthPoints(dashboard),
    next_recommendations: buildRecommendations(dashboard, weakUnits),
  };
}

const bulleted = (lines: readonly string[], emptyLine: string): readonly string[] =>
  (lines.length > 0 ? lines : [emptyLine]).map((line) => `・${line}`);

const mistakeLine = (dashboard: DashboardReport, correctCount: number): string => {
  const hasTendency =
    dashboard.todayQuestionCount > correctCount &&
    dashboard.commonMistake !== NO_MISTAKE_TENDENCY;
  return hasTendency
    ? `「${dashboard.commonMistake}」をいっしょに見直すと、さらに伸びそうです`
    : "気になる間違え方はありませんでした";
};

/** doc.md §17 の通知フォーマット(8項目の順序固定)。 */
export function formatReportMessage(
  dashboard: DashboardReport,
  report: ParentReportContent,
): string {
  const correctCount = dashboard.todayAttempts.filter((attempt) => attempt.isCorrect).length;
  return [
    "【今日の学習レポート】",
    "",
    `学習時間:${dashboard.studyMinutes}分`,
    `今日の問題:${dashboard.todayQuestionCount}問`,
    `正答率:${correctCount}/${dashboard.todayQuestionCount}`,
    "",
    "よくできた単元:",
    ...bulleted(masteredTodayUnits(dashboard), "つぎの学習で見つけていきましょう"),
    "",
    "少し苦手:",
    ...bulleted(report.weak_units, "いまのところありません"),
    "",
    "間違え方:",
    `・${mistakeLine(dashboard, correctCount)}`,
    "",
    "次のおすすめ:",
    ...report.next_recommendations,
    "",
    "今日のひとこと:",
    report.summary,
  ].join("\n");
}
