import { describe, expect, it } from "vitest";
import { getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import { PRACTICE_COUNT, buildCurriculumPractice } from "@/lib/curriculum/practice";

describe("buildCurriculumPractice", () => {
  it("returns five items, same unit first, never the problem itself", () => {
    const items = buildCurriculumPractice("order-of-operations-1");
    expect(items).toHaveLength(PRACTICE_COUNT);
    expect(items.map((item) => item.sourceId)).not.toContain("order-of-operations-1");
    expect(items[0].unit).toBe("計算のきまり");
    expect(items[1].unit).toBe("計算のきまり");
  });

  it("stays within the same subject", () => {
    for (const item of buildCurriculumPractice("english-colors-1")) {
      expect(getCurriculumProblemById(item.sourceId)?.subject).toBe("english");
    }
    for (const item of buildCurriculumPractice("kanji-1")) {
      expect(getCurriculumProblemById(item.sourceId)?.subject).toBe("japanese");
    }
  });

  it("is deterministic and keeps english choices and listen text", () => {
    const first = buildCurriculumPractice("english-animals-1");
    expect(buildCurriculumPractice("english-animals-1")).toEqual(first);
    for (const item of first) {
      expect(item.choices).toContain(item.answer);
    }
    expect(first.some((item) => item.listenText)).toBe(true);
  });

  it("builds numeric choices for math answers that look like numbers", () => {
    const withChoices = buildCurriculumPractice("order-of-operations-1").filter((item) => item.choices);
    expect(withChoices.length).toBeGreaterThan(0);
    for (const item of withChoices) expect(item.choices).toContain(item.answer);
  });

  it("returns nothing for unknown problems", () => {
    expect(buildCurriculumPractice("nope")).toEqual([]);
  });
});
