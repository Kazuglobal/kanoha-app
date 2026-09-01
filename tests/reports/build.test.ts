import { describe, expect, it } from "vitest";
import { buildParentReport, formatReportMessage } from "@/lib/reports/build";
import { buildDashboard } from "@/lib/reports/dashboard";

const dashboard = buildDashboard({
  now: new Date("2026-06-13T12:00:00+09:00"),
  attempts: [
    { created_at: "2026-06-13T01:00:00Z", hint_level_used: 2, is_correct: true, mistake_type: null, problem_id: "p1", similar_problem_id: null },
    { created_at: "2026-06-13T02:00:00Z", hint_level_used: 0, is_correct: false, mistake_type: "unit_conversion_error", problem_id: null, similar_problem_id: "s1" },
  ],
  problems: [{ id: "p1", problem_text: "1Lは何mL？", unit: "かさ" }],
  similarProblems: [{ id: "s1", problem_text: "2Lは何mL？", unit: "かさ" }],
  sessions: [
    { started_at: "2026-06-13T01:00:00Z", duration_seconds: 600 },
    { started_at: "2026-06-12T01:00:00Z", duration_seconds: 300 },
  ],
  weaknesses: [{ accuracy_rate: 0.5, mastery_level: "learning", mistake_count: 2, sub_unit: "LとmL", unit: "かさ" }],
  reviews: [{ problem_id: "p1", scheduled_for: "2026-06-14", status: "pending", sub_unit: "LとmL", unit: "かさ" }],
});

const NEGATIVE_WORDS = ["だめ", "ダメ", "できていません", "悪い", "おくれ", "反省"];

describe("buildParentReport (doc.md §6.4)", () => {
  it("derives every field from the dashboard aggregates", () => {
    const report = buildParentReport(dashboard);

    expect(report.accuracy_rate).toBe(0.5);
    expect(report.weak_units).toEqual(["かさ・LとmL"]);
    expect(report.growth_points.length).toBeGreaterThan(0);
    expect(report.next_recommendations).toHaveLength(1);
    expect(report.next_recommendations[0]).toContain("復習");
    expect(report.next_recommendations[0]).toContain("かさ · LとmL");
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it("keeps the tone encouraging and never negative", () => {
    const text = JSON.stringify(buildParentReport(dashboard));
    for (const word of NEGATIVE_WORDS) {
      expect(text).not.toContain(word);
    }
  });

  it("stays encouraging on a day without any attempts", () => {
    const empty = buildDashboard({
      now: new Date("2026-06-13T12:00:00+09:00"),
      attempts: [], problems: [], reviews: [], sessions: [], similarProblems: [], weaknesses: [],
    });
    const report = buildParentReport(empty);
    expect(report.accuracy_rate).toBe(0);
    expect(report.summary).toContain("明日");
    for (const word of NEGATIVE_WORDS) {
      expect(JSON.stringify(report)).not.toContain(word);
    }
  });
});

describe("formatReportMessage (doc.md §17)", () => {
  it("renders the 8 items in the fixed order with real values", () => {
    const message = formatReportMessage(dashboard, buildParentReport(dashboard));
    const headers = [
      "学習時間", "今日の問題", "正答率", "よくできた単元",
      "少し苦手", "間違え方", "次のおすすめ", "今日のひとこと",
    ];
    const positions = headers.map((header) => message.indexOf(header));
    positions.forEach((position) => expect(position).toBeGreaterThanOrEqual(0));
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);

    expect(message).toContain("学習時間:10分");
    expect(message).toContain("今日の問題:2問");
    expect(message).toContain("正答率:1/2");
    expect(message).toContain("・かさ");
    expect(message).toContain("・かさ・LとmL");
    expect(message).toContain("単位の変換");
    for (const word of NEGATIVE_WORDS) {
      expect(message).not.toContain(word);
    }
  });
});
