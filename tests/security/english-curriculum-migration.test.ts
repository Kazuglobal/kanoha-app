import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { GRADE_2_ALL_UNITS } from "@/lib/curriculum/subjects";
import { ALL_MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";

const migration = readFileSync("supabase/migrations/0014_english_curriculum.sql", "utf8");
const d1Migration = readFileSync("drizzle/migrations/0001_curriculum_problems_and_listen_text.sql", "utf8");

const constraintBody = (name: string): string => {
  const match = migration.match(new RegExp(`add constraint ${name} ([\\s\\S]*?);`));
  expect(match, `constraint ${name} must be added`).not.toBeNull();
  return match![1];
};

describe("english curriculum constraints migration (0014)", () => {
  it("allows the english subject", () => {
    const body = constraintBody("problems_subject_check");
    for (const subject of ["math", "japanese", "english"]) expect(body).toContain(`'${subject}'`);
  });

  it.each(["problems", "generated_similar_problems", "weakness_map", "review_schedule"])(
    "restricts %s.unit to every grade 2 unit (math + japanese + english)",
    (table) => {
      const body = constraintBody(`${table}_unit_check`);
      for (const unit of GRADE_2_ALL_UNITS) expect(body).toContain(`'${unit}'`);
      expect(body.match(/'[^']+'/g) ?? []).toHaveLength(GRADE_2_ALL_UNITS.length);
    },
  );

  it("re-defines attempts.mistake_type with every mistakeTypes id", () => {
    const body = constraintBody("attempts_mistake_type_check");
    for (const id of ALL_MISTAKE_TYPE_IDS) expect(body).toContain(`'${id}'`);
    expect(body.match(/'[^']+'/g) ?? []).toHaveLength(ALL_MISTAKE_TYPE_IDS.length);
  });

  it("adds the curriculum problem id (unique per child) and listen text columns in D1 too", () => {
    for (const sql of [migration, d1Migration]) {
      expect(sql).toMatch(/curriculum_problem_id/);
      expect(sql).toMatch(/problems_child_curriculum_unique/);
      expect(sql).toMatch(/listen_text/);
    }
  });
});
