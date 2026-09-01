-- W1 基盤整合 (A4/A5, B1):
--  * review_schedule に UNIQUE(child_id, problem_id) を追加し upsert(onConflict) を成立させる
--  * unit の許容値を lib/curriculum/grade2Math.ts の 11 単元に固定する
--  * attempts.mistake_type の CHECK を lib/curriculum/mistakeTypes.ts の 13 種として再定義する
-- 冪等: drop constraint if exists → add constraint の順で書く。既存マイグレーションは変更しない。

-- B1: review_schedule upsert キー
alter table public.review_schedule
  drop constraint if exists review_schedule_child_problem_key;
alter table public.review_schedule
  add constraint review_schedule_child_problem_key unique (child_id, problem_id);

-- A5: unit は grade2Math.ts の単元名のみ(sub_unit は自由記述のまま)
alter table public.problems
  drop constraint if exists problems_unit_check;
alter table public.problems
  add constraint problems_unit_check check (unit in (
    '表とグラフ', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形'
  ));

alter table public.generated_similar_problems
  drop constraint if exists generated_similar_problems_unit_check;
alter table public.generated_similar_problems
  add constraint generated_similar_problems_unit_check check (unit in (
    '表とグラフ', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形'
  ));

alter table public.weakness_map
  drop constraint if exists weakness_map_unit_check;
alter table public.weakness_map
  add constraint weakness_map_unit_check check (unit in (
    '表とグラフ', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形'
  ));

alter table public.review_schedule
  drop constraint if exists review_schedule_unit_check;
alter table public.review_schedule
  add constraint review_schedule_unit_check check (unit in (
    '表とグラフ', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形'
  ));

-- A4: mistake_type は mistakeTypes.ts の 13 種。0001 と同じ集合だが、このファイルを正とする
alter table public.attempts
  drop constraint if exists attempts_mistake_type_check;
alter table public.attempts
  add constraint attempts_mistake_type_check check (
    mistake_type is null or mistake_type in (
      'calculation_error', 'place_value_error', 'carry_error', 'borrow_error',
      'operation_choice_error', 'unit_conversion_error', 'reading_comprehension_error',
      'multiplication_fact_error', 'time_error', 'geometry_error', 'careless_error',
      'unanswered', 'other'
    )
  );
