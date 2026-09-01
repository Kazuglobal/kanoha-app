create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 40),
  grade smallint not null default 2 check (grade between 1 and 6),
  preferred_style text not null default 'praise_coach' check (preferred_style in ('praise_coach')),
  reading_mode text not null default 'kanji_with_ruby' check (reading_mode in ('kanji_with_ruby', 'hiragana')),
  audio_voice text not null default 'friendly' check (audio_voice in ('friendly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.uploaded_materials (
  id uuid primary key default extensions.gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  file_urls text[] not null check (cardinality(file_urls) > 0),
  file_type text not null,
  page_count smallint not null check (page_count > 0 and page_count = cardinality(file_urls)),
  source_type text not null check (source_type in ('school_print', 'tablet_screenshot', 'textbook', 'other')),
  status text not null default 'pending' check (status in ('pending', 'analyzing', 'done', 'failed')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, child_id)
);

create table if not exists public.problems (
  id uuid primary key default extensions.gen_random_uuid(),
  material_id uuid,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  problem_text text not null,
  problem_image_url text,
  subject text not null default 'math',
  grade smallint not null default 2 check (grade between 1 and 6),
  unit text not null,
  sub_unit text not null default '',
  difficulty text not null default 'standard' check (difficulty in ('very_easy', 'easy', 'standard', 'challenging')),
  correct_answer text not null,
  explanation_json jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation_json) = 'object'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, child_id),
  foreign key (material_id, child_id)
    references public.uploaded_materials(id, child_id) on delete set null (material_id)
);

create table if not exists public.learning_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  total_questions smallint not null default 0 check (total_questions >= 0),
  correct_count smallint not null default 0 check (correct_count >= 0 and correct_count <= total_questions),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, child_id),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.generated_similar_problems (
  id uuid primary key default extensions.gen_random_uuid(),
  source_problem_id uuid not null,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  problem_text text not null,
  answer text not null,
  explanation text not null,
  unit text not null,
  sub_unit text not null default '',
  difficulty text not null default 'standard' check (difficulty in ('very_easy', 'easy', 'standard', 'challenging')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, child_id),
  foreign key (source_problem_id, child_id) references public.problems(id, child_id) on delete cascade
);

create table if not exists public.attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  problem_id uuid,
  similar_problem_id uuid,
  child_answer text,
  answer_type text not null check (answer_type in ('tap', 'text', 'voice', 'handwriting')),
  is_correct boolean not null,
  hint_level_used smallint not null default 0 check (hint_level_used between 0 and 4),
  mistake_type text check (
    mistake_type is null or mistake_type in (
      'calculation_error', 'place_value_error', 'carry_error', 'borrow_error',
      'operation_choice_error', 'unit_conversion_error', 'reading_comprehension_error',
      'multiplication_fact_error', 'time_error', 'geometry_error', 'careless_error',
      'unanswered', 'other'
    )
  ),
  ai_feedback text,
  created_at timestamptz not null default now(),
  foreign key (session_id, child_id) references public.learning_sessions(id, child_id) on delete cascade,
  foreign key (problem_id, child_id) references public.problems(id, child_id) on delete cascade,
  foreign key (similar_problem_id, child_id) references public.generated_similar_problems(id, child_id) on delete cascade,
  check (num_nonnulls(problem_id, similar_problem_id) = 1)
);

create table if not exists public.weakness_map (
  id uuid primary key default extensions.gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  unit text not null,
  sub_unit text not null default '',
  accuracy_rate numeric(5, 4) not null default 0 check (accuracy_rate between 0 and 1),
  mistake_count integer not null default 0 check (mistake_count >= 0),
  last_attempted_at timestamptz,
  next_review_at timestamptz,
  mastery_level text not null default 'learning' check (mastery_level in ('learning', 'reviewing', 'mastered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, unit, sub_unit)
);

create table if not exists public.review_schedule (
  id uuid primary key default extensions.gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  problem_id uuid not null,
  unit text not null,
  sub_unit text not null default '',
  scheduled_for date not null,
  review_stage smallint not null default 1 check (review_stage between 1 and 3),
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (problem_id, child_id) references public.problems(id, child_id) on delete cascade
);

create table if not exists public.parent_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  report_date date not null,
  summary text not null,
  accuracy_rate numeric(5, 4) not null default 0 check (accuracy_rate between 0 and 1),
  weak_units jsonb not null default '[]'::jsonb check (jsonb_typeof(weak_units) = 'array'),
  growth_points jsonb not null default '[]'::jsonb check (jsonb_typeof(growth_points) = 'array'),
  next_recommendations jsonb not null default '[]'::jsonb check (jsonb_typeof(next_recommendations) = 'array'),
  slack_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, report_date)
);

create table if not exists public.app_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  child_id uuid not null unique references public.child_profiles(id) on delete cascade,
  explanation_level text not null default 'easy' check (explanation_level in ('very_easy', 'easy', 'standard')),
  daily_limit_minutes smallint not null default 15 check (daily_limit_minutes between 1 and 180),
  enable_slack boolean not null default false,
  slack_webhook_secret_id uuid,
  enable_audio boolean not null default true,
  enable_voice_answer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (enable_slack = false or slack_webhook_secret_id is not null)
);

create index if not exists child_profiles_user_id_idx on public.child_profiles (user_id);
create index if not exists uploaded_materials_child_created_idx on public.uploaded_materials (child_id, created_at desc);
create index if not exists uploaded_materials_expiry_idx on public.uploaded_materials (expires_at) where status <> 'analyzing';
create index if not exists problems_child_status_unit_idx on public.problems (child_id, status, unit, sub_unit);
create index if not exists problems_material_id_idx on public.problems (material_id) where material_id is not null;
create index if not exists learning_sessions_child_started_idx on public.learning_sessions (child_id, started_at desc);
create index if not exists similar_problems_source_idx on public.generated_similar_problems (source_problem_id);
create index if not exists similar_problems_child_unit_idx on public.generated_similar_problems (child_id, unit, sub_unit);
create index if not exists attempts_session_idx on public.attempts (session_id);
create index if not exists attempts_child_created_idx on public.attempts (child_id, created_at desc);
create index if not exists attempts_problem_idx on public.attempts (problem_id) where problem_id is not null;
create index if not exists attempts_similar_problem_idx on public.attempts (similar_problem_id) where similar_problem_id is not null;
create index if not exists weakness_map_child_accuracy_idx on public.weakness_map (child_id, accuracy_rate, mastery_level);
create index if not exists weakness_map_due_idx on public.weakness_map (child_id, next_review_at) where next_review_at is not null;
create index if not exists review_schedule_pending_due_idx on public.review_schedule (child_id, scheduled_for, review_stage) where status = 'pending';
create index if not exists review_schedule_problem_idx on public.review_schedule (problem_id);
create index if not exists parent_reports_child_date_idx on public.parent_reports (child_id, report_date desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.users.display_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'child_profiles', 'uploaded_materials', 'problems',
    'learning_sessions', 'generated_similar_problems', 'weakness_map',
    'review_schedule', 'parent_reports', 'app_settings'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'set_' || table_name || '_updated_at',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end;
$$;
