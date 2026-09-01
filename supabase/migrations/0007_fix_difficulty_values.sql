-- doc.md #235: difficulty must be "basic" | "standard" | "advanced",
-- but 0001 used a different value set that AI-generated problems would violate.
alter table public.problems
  drop constraint if exists problems_difficulty_check;
alter table public.problems
  add constraint problems_difficulty_check check (difficulty in ('basic', 'standard', 'advanced'));

alter table public.generated_similar_problems
  drop constraint if exists generated_similar_problems_difficulty_check;
alter table public.generated_similar_problems
  add constraint generated_similar_problems_difficulty_check check (difficulty in ('basic', 'standard', 'advanced'));
