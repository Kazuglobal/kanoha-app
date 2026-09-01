-- W3 子どもモード + サーバー側段階開示 (A1 / A2):
--  * users に親 PIN(scrypt ハッシュ)とロックアウト用の列を追加する。
--    これらの列は authenticated / anon から読めない・書けない(service_role だけが扱う)。
--    Postgres では表レベルの select 権限が残っていると列レベルの revoke は効かないため、
--    users の select / insert / update を一度 revoke し、PIN 以外の列にだけ再 grant する。
--    (grep の結果、アプリ側に users への select('*') は存在しない)
--  * problem_hint_views: 子どもが (child, problem, session) ごとに開いた最大ヒント段階。
--    /api/problems/[id]/hint が level <= max_level + 1 の規則で upsert し、
--    /api/attempts は hint_level_used をここから読む(クライアント値は使わない)。
--  * generated_similar_problems.choices: 生成時にサーバーが作った 4 択(jsonb)。
--    数値で解釈できない答えは null(クライアントは文字入力にフォールバック)。
-- 冪等: if not exists / drop policy if exists / create or replace のみ。既存マイグレーションは変更しない。

alter table public.users
  add column if not exists parent_pin_hash text,
  add column if not exists parent_pin_failed_attempts smallint not null default 0
    check (parent_pin_failed_attempts >= 0),
  add column if not exists parent_pin_locked_until timestamptz;

revoke select, insert, update on public.users from authenticated;
grant select (id, email, display_name, created_at, updated_at) on public.users to authenticated;
grant insert (id, email, display_name) on public.users to authenticated;
grant update (email, display_name) on public.users to authenticated;
revoke all on public.users from anon;

create table if not exists public.problem_hint_views (
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  problem_id uuid not null,
  session_id uuid not null,
  max_level smallint not null default 0 check (max_level between 0 and 4),
  updated_at timestamptz not null default now(),
  primary key (child_id, problem_id, session_id),
  foreign key (problem_id, child_id) references public.problems(id, child_id) on delete cascade,
  foreign key (session_id, child_id) references public.learning_sessions(id, child_id) on delete cascade
);

alter table public.problem_hint_views enable row level security;
alter table public.problem_hint_views force row level security;

drop policy if exists problem_hint_views_owner_all on public.problem_hint_views;
create policy problem_hint_views_owner_all on public.problem_hint_views
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

revoke all on public.problem_hint_views from anon, public;
grant select, insert, update, delete on public.problem_hint_views to authenticated;

drop trigger if exists set_problem_hint_views_updated_at on public.problem_hint_views;
create trigger set_problem_hint_views_updated_at
  before update on public.problem_hint_views
  for each row execute function public.set_updated_at();

alter table public.generated_similar_problems
  add column if not exists choices jsonb
    check (choices is null or (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4));
