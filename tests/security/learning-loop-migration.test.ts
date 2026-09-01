import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/0009_learning_loop.sql", "utf8");
const rlsTest = readFileSync("supabase/tests/rls_isolation.sql", "utf8");

const functionBody = (): string => {
  const match = migration.match(
    /create or replace function public\.recompute_weakness\(([\s\S]*?)\$\$;/,
  );
  expect(match, "recompute_weakness must be defined").not.toBeNull();
  return match![0];
};

describe("learning loop migration (recompute_weakness)", () => {
  it("runs as security definer with an empty search_path", () => {
    const body = functionBody();
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
  });

  it("refuses children the caller does not own before touching data", () => {
    const body = functionBody();
    const guard = body.indexOf("if not public.owns_child(target_child_id) then");
    const raise = body.indexOf("raise exception");
    const firstWrite = body.indexOf("insert into public.weakness_map");
    expect(guard).toBeGreaterThan(-1);
    expect(raise).toBeGreaterThan(guard);
    expect(firstWrite).toBeGreaterThan(raise);
  });

  it("recomputes from every attempt of the unit and upserts in one statement", () => {
    const body = functionBody();
    expect(body).toContain("from public.attempts as attempt");
    expect(body).toContain("left join public.problems as problem");
    expect(body).toContain("left join public.generated_similar_problems as similar");
    expect(body).toContain("coalesce(problem.unit, similar.unit) = target_unit");
    expect(body).toContain("on conflict (child_id, unit, sub_unit) do update");
    expect(body.match(/insert into public\.weakness_map/g)).toHaveLength(1);
  });

  it("uses the same mastery rule as lib/review/weakness.ts", () => {
    const body = functionBody();
    expect(body).toMatch(/attempt_count >= 5[\s\S]*>= 0\.8 then 'mastered'/);
    expect(body).toContain("when stats.correct_count > 0 then 'reviewing'");
    expect(body).toContain("else 'learning'");
  });

  it("keeps mastered sticky on conflict (T011 D1): only the schedule route may demote", () => {
    const body = functionBody();
    const update = body.slice(body.indexOf("on conflict (child_id, unit, sub_unit) do update"));
    expect(update).toMatch(
      /mastery_level = case\s+when excluded\.mastery_level = 'mastered'\s+or public\.weakness_map\.mastery_level = 'mastered' then 'mastered'\s+else excluded\.mastery_level\s+end/,
    );
    expect(update).not.toMatch(/mastery_level = excluded\.mastery_level\s*,/);
  });

  it("guards the accuracy division with nullif(attempt_count, 0)", () => {
    const body = functionBody();
    expect(body).toContain("coalesce(round(stats.correct_count::numeric / nullif(stats.attempt_count, 0), 4), 0)");
    expect(body).toContain("stats.correct_count::numeric / nullif(stats.attempt_count, 0) >= 0.8");
    expect(body).not.toMatch(/correct_count::numeric \/ stats\.attempt_count\b/);
  });

  it("revokes public/anon execution and grants only authenticated", () => {
    expect(migration).toContain(
      "revoke all on function public.recompute_weakness(uuid, text, text) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.recompute_weakness(uuid, text, text) to authenticated;",
    );
    expect(migration).not.toMatch(/grant execute[^;]*to (anon|public)/);
  });

  it("does not rewrite earlier migrations' objects", () => {
    expect(migration).not.toContain("alter table");
    expect(migration).not.toContain("drop function");
  });

  it("is covered by the RLS isolation test for another family's child", () => {
    expect(rlsTest).toContain("recompute_weakness refuses another parent child");
    expect(rlsTest).toMatch(/throws_ok\(\s*\$\$select \* from public\.recompute_weakness\(\s*'10000000-0000-0000-0000-000000000002'/);
  });
});
