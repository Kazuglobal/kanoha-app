-- W4 AI層堅牢化 (B10):
--  * increment_ai_usage: AI呼び出しの「前」に、JST当日の calls / cost_usd を 1 文の upsert で
--    原子的に予約する。両方の上限内のときだけ増分し、結果(allowed と現在値)を返す。
--    上限超過は allowed=false(呼び出し元は 429)。プロバイダ失敗時の払い戻しはしない。
--    呼び出しは認証ユーザー自身の分のみ(p_user = auth.uid() を強制)。
--  * app_settings.enable_image_generation: AI画像生成の親許可(既定 false、doc.md §19)。
-- 冪等: add column if not exists / create or replace のみ。既存マイグレーションは変更しない。

alter table public.app_settings
  add column if not exists enable_image_generation boolean not null default false;

create or replace function public.increment_ai_usage(
  p_user uuid,
  p_cost numeric,
  p_call_limit integer,
  p_cost_limit numeric
)
returns table(allowed boolean, calls integer, cost_usd numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_user is distinct from auth.uid() then
    raise exception 'ai usage owner mismatch';
  end if;

  return query
  with reserved as (
    insert into public.ai_usage_daily as daily (user_id, usage_date, calls, cost_usd, updated_at)
    select p_user, (now() at time zone 'Asia/Tokyo')::date, 1, p_cost, now()
    where 1 <= p_call_limit and p_cost <= p_cost_limit
    on conflict (user_id, usage_date) do update
      set calls = daily.calls + 1,
          cost_usd = daily.cost_usd + excluded.cost_usd,
          updated_at = now()
      where daily.calls + 1 <= p_call_limit
        and daily.cost_usd + excluded.cost_usd <= p_cost_limit
    returning daily.calls, daily.cost_usd
  ),
  current_row as (
    select day.calls, day.cost_usd
    from public.ai_usage_daily as day
    where day.user_id = p_user
      and day.usage_date = (now() at time zone 'Asia/Tokyo')::date
  )
  select
    exists (select 1 from reserved),
    coalesce((select reserved.calls from reserved), (select current_row.calls from current_row), 0)::integer,
    coalesce((select reserved.cost_usd from reserved), (select current_row.cost_usd from current_row), 0)::numeric;
end;
$$;

revoke all on function public.increment_ai_usage(uuid, numeric, integer, numeric) from public, anon;
grant execute on function public.increment_ai_usage(uuid, numeric, integer, numeric) to authenticated;
