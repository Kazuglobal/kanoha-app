import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { GRADE_2_JAPANESE_UNITS } from "@/lib/curriculum/grade2Japanese";
import { GRADE_2_MATH_UNITS } from "@/lib/curriculum/grade2Math";
import { JAPANESE_MISTAKE_TYPES, MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";

// 0013 時点の単元・間違えタイプ(英語は 0014: english-curriculum-migration.test.ts)
const GRADE_2_ALL_UNITS = [...GRADE_2_MATH_UNITS, ...GRADE_2_JAPANESE_UNITS];
const ALL_MISTAKE_TYPE_IDS = [...MISTAKE_TYPE_IDS, ...JAPANESE_MISTAKE_TYPES.map(({ id }) => id)];

const migration = readFileSync("supabase/migrations/0013_japanese_curriculum.sql", "utf8");

const constraintBody = (name: string): string => {
  const pattern = new RegExp(`add constraint ${name} ([\\s\\S]*?);`);
  const match = migration.match(pattern);
  expect(match, `constraint ${name} must be added`).not.toBeNull();
  return match![1];
};

describe("japanese curriculum constraints migration (0013)", () => {
  it("adds the problems_subject_check constraint", () => {
    expect(migration).toContain("drop constraint if exists problems_subject_check;");
    const body = constraintBody("problems_subject_check");
    expect(body).toContain("'math'");
    expect(body).toContain("'japanese'");
  });

  it.each(["problems", "generated_similar_problems", "weakness_map", "review_schedule"])(
    "restricts %s.unit to every grade 2 unit (math + japanese)",
    (table) => {
      expect(migration).toContain(`drop constraint if exists ${table}_unit_check;`);
      const body = constraintBody(`${table}_unit_check`);
      for (const unit of GRADE_2_ALL_UNITS) {
        expect(body).toContain(`'${unit}'`);
      }
      const quoted = body.match(/'[^']+'/g) ?? [];
      expect(quoted).toHaveLength(GRADE_2_ALL_UNITS.length);
    },
  );

  it("re-defines attempts.mistake_type with every mistakeTypes id (math + japanese)", () => {
    expect(migration).toContain("drop constraint if exists attempts_mistake_type_check;");
    const body = constraintBody("attempts_mistake_type_check");
    for (const id of ALL_MISTAKE_TYPE_IDS) {
      expect(body).toContain(`'${id}'`);
    }
    const quoted = body.match(/'[^']+'/g) ?? [];
    expect(quoted).toHaveLength(ALL_MISTAKE_TYPE_IDS.length);
    expect(body).toContain("mistake_type is null or");
  });
});
