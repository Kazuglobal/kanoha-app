create or replace function public.owns_child(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_profiles
    where id = target_child_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_child(uuid) from public;
grant execute on function public.owns_child(uuid) to authenticated;

create or replace function public.owns_child_path(target_child_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_profiles
    where id::text = target_child_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_child_path(text) from public;
grant execute on function public.owns_child_path(text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'child_profiles', 'uploaded_materials', 'problems', 'learning_sessions',
    'attempts', 'generated_similar_problems', 'weakness_map', 'review_schedule',
    'parent_reports', 'app_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end;
$$;

drop policy if exists users_owner_all on public.users;
create policy users_owner_all on public.users
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists child_profiles_owner_all on public.child_profiles;
create policy child_profiles_owner_all on public.child_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists uploaded_materials_owner_all on public.uploaded_materials;
create policy uploaded_materials_owner_all on public.uploaded_materials
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists problems_owner_all on public.problems;
create policy problems_owner_all on public.problems
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists learning_sessions_owner_all on public.learning_sessions;
create policy learning_sessions_owner_all on public.learning_sessions
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists attempts_owner_all on public.attempts;
create policy attempts_owner_all on public.attempts
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists similar_problems_owner_all on public.generated_similar_problems;
create policy similar_problems_owner_all on public.generated_similar_problems
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists weakness_map_owner_all on public.weakness_map;
create policy weakness_map_owner_all on public.weakness_map
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists review_schedule_owner_all on public.review_schedule;
create policy review_schedule_owner_all on public.review_schedule
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists parent_reports_owner_all on public.parent_reports;
create policy parent_reports_owner_all on public.parent_reports
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

drop policy if exists app_settings_owner_all on public.app_settings;
create policy app_settings_owner_all on public.app_settings
  for all to authenticated
  using ((select public.owns_child(child_id)))
  with check ((select public.owns_child(child_id)));

revoke all on
  public.users,
  public.child_profiles,
  public.uploaded_materials,
  public.problems,
  public.learning_sessions,
  public.attempts,
  public.generated_similar_problems,
  public.weakness_map,
  public.review_schedule,
  public.parent_reports,
  public.app_settings
from anon;
grant select, insert, update, delete on
  public.users,
  public.child_profiles,
  public.uploaded_materials,
  public.problems,
  public.learning_sessions,
  public.attempts,
  public.generated_similar_problems,
  public.weakness_map,
  public.review_schedule,
  public.parent_reports,
  public.app_settings
to authenticated;
