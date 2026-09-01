-- W5 レポート/Slack/セキュリティ (B5, B10):
--  * api_rate_limits + check_rate_limit(): 全 mutating API の DB バックドなレート制限。
--    1 文のアトミック upsert(期限切れウィンドウはリセット、それ以外は加算)。
--    キーは `auth.uid():action` に限定し、他人のキーは拒否する。
--  * generate_daily_reports(): JST 21:00 (UTC 12:00) の pg_cron フォールバック。
--    当日 attempts があり Slack 有効な子の parent_reports 行を「まだ無ければ」SQL 集計で作る。
--    Slack 送信はしない(送信はセッション終了時の API 側。cron は行の生成のみ)。
-- 冪等: create table if not exists / create or replace / unschedule→schedule のみ。
-- 既存マイグレーション(0001〜0011)は変更しない。

create table if not exists public.api_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

alter table public.api_rate_limits enable row level security;

-- 直接の読み書きは許可しない(定義者権限の RPC だけが触る)。
revoke all on table public.api_rate_limits from public, anon, authenticated;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  within_limit boolean;
begin
  if auth.uid() is null or p_key not like auth.uid()::text || ':%' then
    raise exception 'rate limit key owner mismatch';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.api_rate_limits as rate (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
        when rate.window_start <= now() - make_interval(secs => p_window_seconds) then 1
        else rate.count + 1
      end,
      window_start = case
        when rate.window_start <= now() - make_interval(secs => p_window_seconds) then now()
        else rate.window_start
      end
  returning rate.count <= p_limit
  into within_limit;

  return within_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

create or replace function public.generate_daily_reports()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count bigint;
begin
  insert into public.parent_reports
    (child_id, report_date, summary, accuracy_rate, weak_units, growth_points, next_recommendations)
  select
    stats.child_id,
    stats.report_date,
    '今日も学習に取り組みました。くわしくはダッシュボードをごらんください。',
    stats.accuracy,
    coalesce(weak.units, '[]'::jsonb),
    '[]'::jsonb,
    '[]'::jsonb
  from (
    select
      attempt.child_id,
      (now() at time zone 'Asia/Tokyo')::date as report_date,
      round(avg(case when attempt.is_correct then 1.0 else 0.0 end), 4) as accuracy
    from public.attempts as attempt
    where (attempt.created_at at time zone 'Asia/Tokyo')::date
      = (now() at time zone 'Asia/Tokyo')::date
    group by attempt.child_id
  ) as stats
  join public.app_settings as settings
    on settings.child_id = stats.child_id
   and settings.enable_slack
  left join lateral (
    select jsonb_agg(weakness.unit || '・' || weakness.sub_unit) as units
    from (
      select unit, sub_unit
      from public.weakness_map
      where child_id = stats.child_id
        and mastery_level <> 'mastered'
      order by accuracy_rate asc
      limit 3
    ) as weakness
  ) as weak on true
  on conflict (child_id, report_date) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.generate_daily_reports() from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'generate-daily-reports'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'generate-daily-reports',
    '0 12 * * *',
    'select public.generate_daily_reports();'
  );
end;
$$;
