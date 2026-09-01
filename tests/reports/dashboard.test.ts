import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/lib/reports/dashboard";

describe("buildDashboard", () => {
  it("derives today's metrics, history, weakness, review, and streak", () => {
    const report = buildDashboard({
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

    expect(report.todayQuestionCount).toBe(2);
    expect(report.accuracyRate).toBe(0.5);
    expect(report.studyMinutes).toBe(10);
    expect(report.streakDays).toBe(2);
    expect(report.commonMistake).toBe("単位の変換");
    expect(report.todayAttempts[0].question).toBe("1Lは何mL？");
    expect(report.dueReview?.label).toBe("かさ · LとmL");
  });
});

