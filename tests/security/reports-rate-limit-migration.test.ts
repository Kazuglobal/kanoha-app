import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/0012_reports_rate_limit.sql", "utf8");

describe("0012 reports + rate limit migration", () => {
  it("locks api_rate_limits behind the security definer RPC", () => {
    expect(migration).toContain("alter table public.api_rate_limits enable row level security;");
    expect(migration).toContain(
      "revoke all on table public.api_rate_limits from public, anon, authenticated;",
    );
  });

  it("guards check_rate_limit keys by auth.uid() and updates atomically", () => {
    expect(migration).toContain("p_key not like auth.uid()::text || ':%'");
    expect(migration).toContain("rate limit key owner mismatch");
    expect(migration).toContain("on conflict (key) do update");
    expect(migration).toContain(
      "grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;",
    );
    expect(migration).not.toContain("to anon");
  });

  it("keeps daily report generation service-side only, scheduled at 21:00 JST", () => {
    expect(migration).toContain(
      "revoke all on function public.generate_daily_reports() from public, anon, authenticated;",
    );
    expect(migration).toContain("'generate-daily-reports'");
    expect(migration).toContain("'0 12 * * *'");
    expect(migration).toContain("on conflict (child_id, report_date) do nothing;");
    expect(migration).not.toContain("http_post");
  });

  it("uses security definer with an empty search_path for both functions", () => {
    expect((migration.match(/security definer/g) ?? []).length).toBe(2);
    expect((migration.match(/set search_path = ''/g) ?? []).length).toBe(2);
  });
});
