create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.users(id) on delete cascade,
  usage_date date not null,
  calls integer not null default 0 check (calls >= 0),
  cost_usd numeric(10, 6) not null default 0 check (cost_usd >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;
alter table public.ai_usage_daily force row level security;

drop policy if exists ai_usage_daily_owner_select on public.ai_usage_daily;
create policy ai_usage_daily_owner_select on public.ai_usage_daily
  for select to authenticated
  using (user_id = (select auth.uid()));
