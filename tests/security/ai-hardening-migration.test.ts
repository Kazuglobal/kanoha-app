import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/0011_ai_hardening.sql", "utf8");
const rlsTest = readFileSync("supabase/tests/rls_isolation.sql", "utf8");

describe("AI hardening migration (increment_ai_usage)", () => {
  it("runs as security definer with an empty search_path", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("refuses to reserve for another user before touching data", () => {
    const guard = migration.indexOf("p_user is distinct from auth.uid()");
    const raise = migration.indexOf("raise exception 'ai usage owner mismatch'");
    const firstWrite = migration.indexOf("insert into public.ai_usage_daily");
    expect(guard).toBeGreaterThan(-1);
    expect(raise).toBeGreaterThan(guard);
    expect(firstWrite).toBeGreaterThan(raise);
  });

  it("reserves with a single atomic upsert statement", () => {
    expect(migration.match(/insert into public\.ai_usage_daily/g)).toHaveLength(1);
    expect(migration).toContain("on conflict (user_id, usage_date) do update");
  });

  it("increments only when BOTH limits hold, on the first call and on later calls", () => {
    // first call of the day
    expect(migration).toContain("where 1 <= p_call_limit and p_cost <= p_cost_limit");
    // subsequent calls
    expect(migration).toContain("daily.calls + 1 <= p_call_limit");
    expect(migration).toContain("daily.cost_usd + excluded.cost_usd <= p_cost_limit");
  });

  it("uses the Asia/Tokyo date, matching todayKeyJst (A3)", () => {
    expect(migration).toContain("(now() at time zone 'Asia/Tokyo')::date");
    expect(migration).not.toContain("current_date");
  });

  it("reports the outcome (allowed + current counters) instead of failing silently", () => {
    expect(migration).toContain("returns table(allowed boolean, calls integer, cost_usd numeric)");
    expect(migration).toContain("exists (select 1 from reserved)");
  });

  it("revokes public/anon execution and grants only authenticated", () => {
    expect(migration).toContain(
      "revoke all on function public.increment_ai_usage(uuid, numeric, integer, numeric) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.increment_ai_usage(uuid, numeric, integer, numeric) to authenticated;",
    );
    expect(migration).not.toMatch(/grant execute[^;]*to (anon|public)/);
  });

  it("adds enable_image_generation idempotently with default false and touches nothing else", () => {
    expect(migration).toContain(
      "add column if not exists enable_image_generation boolean not null default false",
    );
    expect(migration.match(/alter table/g)).toHaveLength(1);
    expect(migration).toContain("alter table public.app_settings");
    expect(migration).not.toContain("drop function");
    expect(migration).not.toContain("drop table");
  });

  it("is covered by the RLS isolation test for another user's id", () => {
    expect(rlsTest).toContain("increment_ai_usage refuses another user id");
    expect(rlsTest).toMatch(
      /throws_ok\(\s*\$\$select \* from public\.increment_ai_usage\(\s*'00000000-0000-0000-0000-000000000002'/,
    );
  });
});
