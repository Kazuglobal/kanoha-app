import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { GRADE_2_MATH_UNITS } from "@/lib/curriculum/grade2Math";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";

const migration = readFileSync("supabase/migrations/0008_curriculum_constraints.sql", "utf8");

const constraintBody = (name: string): string => {
  const pattern = new RegExp(`add constraint ${name} ([\\s\\S]*?);`);
  const match = migration.match(pattern);
  expect(match, `constraint ${name} must be added`).not.toBeNull();
  return match![1];
};

describe("curriculum constraints migration", () => {
  it("adds the review_schedule upsert key", () => {
    expect(migration).toContain("drop constraint if exists review_schedule_child_problem_key;");
    expect(constraintBody("review_schedule_child_problem_key")).toContain(
      "unique (child_id, problem_id)",
    );
  });

  it.each(["problems", "generated_similar_problems", "weakness_map", "review_schedule"])(
    "restricts %s.unit to every grade2Math unit",
    (table) => {
      expect(migration).toContain(`drop constraint if exists ${table}_unit_check;`);
      const body = constraintBody(`${table}_unit_check`);
      for (const unit of GRADE_2_MATH_UNITS) {
        expect(body).toContain(`'${unit}'`);
      }
      const quoted = body.match(/'[^']+'/g) ?? [];
      expect(quoted).toHaveLength(GRADE_2_MATH_UNITS.length);
    },
  );

  it("re-defines attempts.mistake_type with every mistakeTypes id", () => {
    expect(migration).toContain("drop constraint if exists attempts_mistake_type_check;");
    const body = constraintBody("attempts_mistake_type_check");
    for (const id of MISTAKE_TYPE_IDS) {
      expect(body).toContain(`'${id}'`);
    }
    const quoted = body.match(/'[^']+'/g) ?? [];
    expect(quoted).toHaveLength(MISTAKE_TYPE_IDS.length);
    expect(body).toContain("mistake_type is null or");
  });

  it("does not touch difficulty constraints", () => {
    expect(migration).not.toContain("difficulty_check");
  });
});
