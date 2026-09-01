import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/0010_child_mode_hints.sql", "utf8");
const rlsTest = readFileSync("supabase/tests/rls_isolation.sql", "utf8");

const section = (start: string, end: string): string => {
  const from = migration.indexOf(start);
  expect(from, `${start} must exist`).toBeGreaterThan(-1);
  const to = migration.indexOf(end, from);
  return migration.slice(from, to === -1 ? undefined : to);
};

describe("child mode migration (0010): parent PIN columns", () => {
  it("adds the PIN hash and lockout columns idempotently", () => {
    const users = section("alter table public.users", ";");
    expect(users).toContain("add column if not exists parent_pin_hash text");
    expect(users).toContain("add column if not exists parent_pin_failed_attempts smallint not null default 0");
    expect(users).toContain("add column if not exists parent_pin_locked_until timestamptz");
  });

  it("hides the PIN columns from authenticated by re-granting only the public columns", () => {
    expect(migration).toContain("revoke select, insert, update on public.users from authenticated;");
    const select = migration.match(/grant select \(([^)]*)\) on public\.users to authenticated;/);
    expect(select).not.toBeNull();
    const columns = select![1].split(",").map((column) => column.trim());
    expect(columns).toEqual(["id", "email", "display_name", "created_at", "updated_at"]);
    expect(migration).toMatch(/grant update \((?![^)]*parent_pin)[^)]*\) on public\.users to authenticated;/);
    expect(migration).toMatch(/grant insert \((?![^)]*parent_pin)[^)]*\) on public\.users to authenticated;/);
    expect(migration).toContain("revoke all on public.users from anon;");
    expect(migration).not.toMatch(/grant [^;]*parent_pin[^;]*to (anon|authenticated|public)/);
  });
});

describe("child mode migration (0010): problem_hint_views", () => {
  const table = section("create table if not exists public.problem_hint_views", ");\n");

  it("keys the max hint level by child, problem and session with FKs to owned rows", () => {
    expect(table).toContain("primary key (child_id, problem_id, session_id)");
    expect(table).toContain("max_level smallint not null default 0 check (max_level between 0 and 4)");
    expect(table).toContain("references public.child_profiles(id) on delete cascade");
    expect(table).toContain("foreign key (problem_id, child_id) references public.problems(id, child_id) on delete cascade");
    expect(table).toContain("foreign key (session_id, child_id) references public.learning_sessions(id, child_id) on delete cascade");
  });

  it("enables and forces RLS with the owns_child policy", () => {
    expect(migration).toContain("alter table public.problem_hint_views enable row level security;");
    expect(migration).toContain("alter table public.problem_hint_views force row level security;");
    expect(migration).toContain("drop policy if exists problem_hint_views_owner_all on public.problem_hint_views;");
    const policy = section("create policy problem_hint_views_owner_all", ";");
    expect(policy).toContain("for all to authenticated");
    expect(policy).toContain("using ((select public.owns_child(child_id)))");
    expect(policy).toContain("with check ((select public.owns_child(child_id)))");
  });

  it("grants only authenticated and revokes anon/public", () => {
    expect(migration).toContain("revoke all on public.problem_hint_views from anon, public;");
    expect(migration).toContain("grant select, insert, update, delete on public.problem_hint_views to authenticated;");
  });

  it("adds the similar-problem choices column as a nullable 4-item jsonb array", () => {
    const choices = section("alter table public.generated_similar_problems", ";");
    expect(choices).toContain("add column if not exists choices jsonb");
    expect(choices).toContain("jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4");
    expect(choices).toContain("choices is null or");
  });

  it("does not rewrite earlier migrations' objects", () => {
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("drop column");
    expect(migration).not.toContain("drop function");
  });

  it("is covered by the RLS isolation test", () => {
    expect(rlsTest).toContain("a parent sees only owned problem_hint_views rows");
    expect(rlsTest).toContain("a parent cannot record hint views for another parent child");
    expect(rlsTest).toContain("authenticated cannot read parent_pin_hash");
    expect(rlsTest).toContain("authenticated cannot reset the PIN lockout counter");
    expect(rlsTest).toContain("select plan(13);");
  });
});
