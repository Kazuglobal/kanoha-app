-- W2 学習中核ループ (B2):
--  * attempts 保存後に単元 (child_id, unit, sub_unit) 全体の正答率を SQL 側で再計算し、
--    weakness_map を 1 文の upsert でアトミックに更新する RPC を追加する。
--  * mastery_level の規則は lib/review/weakness.ts (updateWeakness) と同一:
--      attempt_count >= 5 かつ accuracy >= 0.8 → mastered / correct > 0 → reviewing / それ以外 → learning
--    Route Handler は本関数が返した mastery_level を真として扱う(TS 側で再構成しない)。
--  * mastered は sticky: 既存行か新しい値のどちらかが mastered なら mastered を維持する。
--    降格は /api/reviews/schedule(類題 4/5 未満 → masteryAfterSimilarSet)だけが明示的に書く。
--  * 0 除算は nullif(attempt_count, 0) で防ぐ(該当 attempts が無い場合は accuracy 0 / learning)。
-- 冪等: create or replace のみ。既存マイグレーションは変更しない。
-- (T011: 本マイグレーションは未適用のため、その場で修正した。実 DB 適用後は追記のみ。)

create or replace function public.recompute_weakness(
  target_child_id uuid,
  target_unit text,
  target_sub_unit text
)
returns table(
  attempt_count bigint,
  correct_count bigint,
  mistake_count integer,
  accuracy_rate numeric,
  mastery_level text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_child(target_child_id) then
    raise exception 'child profile not found';
  end if;

  return query
  with scoped as (
    select attempt.is_correct, attempt.created_at
    from public.attempts as attempt
    left join public.problems as problem
      on problem.id = attempt.problem_id and problem.child_id = attempt.child_id
    left join public.generated_similar_problems as similar
      on similar.id = attempt.similar_problem_id and similar.child_id = attempt.child_id
    where attempt.child_id = target_child_id
      and coalesce(problem.unit, similar.unit) = target_unit
      and coalesce(problem.sub_unit, similar.sub_unit) = target_sub_unit
  ),
  stats as (
    select
      count(*)::bigint as attempt_count,
      count(*) filter (where scoped.is_correct)::bigint as correct_count,
      max(scoped.created_at) as last_attempted_at
    from scoped
  ),
  upserted as (
    insert into public.weakness_map (
      child_id, unit, sub_unit, accuracy_rate, mistake_count, last_attempted_at, mastery_level
    )
    select
      target_child_id,
      target_unit,
      target_sub_unit,
      coalesce(round(stats.correct_count::numeric / nullif(stats.attempt_count, 0), 4), 0),
      (stats.attempt_count - stats.correct_count)::integer,
      stats.last_attempted_at,
      case
        when stats.attempt_count >= 5
          and stats.correct_count::numeric / nullif(stats.attempt_count, 0) >= 0.8 then 'mastered'
        when stats.correct_count > 0 then 'reviewing'
        else 'learning'
      end
    from stats
    on conflict (child_id, unit, sub_unit) do update
      set accuracy_rate = excluded.accuracy_rate,
          mistake_count = excluded.mistake_count,
          last_attempted_at = excluded.last_attempted_at,
          mastery_level = case
            when excluded.mastery_level = 'mastered'
              or public.weakness_map.mastery_level = 'mastered' then 'mastered'
            else excluded.mastery_level
          end,
          updated_at = now()
    returning
      public.weakness_map.mistake_count,
      public.weakness_map.accuracy_rate,
      public.weakness_map.mastery_level
  )
  select
    stats.attempt_count,
    stats.correct_count,
    upserted.mistake_count,
    upserted.accuracy_rate,
    upserted.mastery_level
  from stats
  cross join upserted;
end;
$$;

revoke all on function public.recompute_weakness(uuid, text, text) from public, anon;
grant execute on function public.recompute_weakness(uuid, text, text) to authenticated;
