-- 0014: 英語（えいご）対応マイグレーション(0013 の後続)
--  * problems.subject の CHECK制約に 'english' を追加
--  * unit_check 制約に英語単元を追加
--  * attempts.mistake_type_check 制約に英語向け間違いタイプを追加
--  * 問題バンク由来の問題(problems.curriculum_problem_id)と、英語の聞き取り文
--    (generated_similar_problems.listen_text)の列を追加
--  ※ 本番 DB(Cloudflare D1)の正は drizzle/migrations/0001_curriculum_problems_and_listen_text.sql

-- 1. problems.subject check
alter table public.problems
  drop constraint if exists problems_subject_check;
alter table public.problems
  add constraint problems_subject_check check (subject in ('math', 'japanese', 'english'));

-- 2. unit check (算数 12 + 国語 6 + 英語 7 単元)
alter table public.problems
  drop constraint if exists problems_unit_check;
alter table public.problems
  add constraint problems_unit_check check (unit in (
    '表とグラフ', '整理する力', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形',
    '漢字', 'ことばのきまり', '文の組み立て', 'お話の読解', '説明文の読解', '作文と表現',
    'アルファベット', 'あいさつ', 'えいごのかず', 'いろ', 'どうぶつ', 'たべもの', 'からだ'
  ));

alter table public.generated_similar_problems
  drop constraint if exists generated_similar_problems_unit_check;
alter table public.generated_similar_problems
  add constraint generated_similar_problems_unit_check check (unit in (
    '表とグラフ', '整理する力', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形',
    '漢字', 'ことばのきまり', '文の組み立て', 'お話の読解', '説明文の読解', '作文と表現',
    'アルファベット', 'あいさつ', 'えいごのかず', 'いろ', 'どうぶつ', 'たべもの', 'からだ'
  ));

alter table public.weakness_map
  drop constraint if exists weakness_map_unit_check;
alter table public.weakness_map
  add constraint weakness_map_unit_check check (unit in (
    '表とグラフ', '整理する力', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形',
    '漢字', 'ことばのきまり', '文の組み立て', 'お話の読解', '説明文の読解', '作文と表現',
    'アルファベット', 'あいさつ', 'えいごのかず', 'いろ', 'どうぶつ', 'たべもの', 'からだ'
  ));

alter table public.review_schedule
  drop constraint if exists review_schedule_unit_check;
alter table public.review_schedule
  add constraint review_schedule_unit_check check (unit in (
    '表とグラフ', '整理する力', '時こくと時間', 'たし算', 'ひき算', '長さ', '水のかさ',
    '三角形と四角形', 'かけ算', '1000より大きい数', '分数', 'はこの形',
    '漢字', 'ことばのきまり', '文の組み立て', 'お話の読解', '説明文の読解', '作文と表現',
    'アルファベット', 'あいさつ', 'えいごのかず', 'いろ', 'どうぶつ', 'たべもの', 'からだ'
  ));

-- 3. mistake_type check (算数 13 種 + 国語 6 種 + 英語 3 種)
alter table public.attempts
  drop constraint if exists attempts_mistake_type_check;
alter table public.attempts
  add constraint attempts_mistake_type_check check (
    mistake_type is null or mistake_type in (
      'calculation_error', 'place_value_error', 'carry_error', 'borrow_error',
      'operation_choice_error', 'unit_conversion_error', 'reading_comprehension_error',
      'multiplication_fact_error', 'time_error', 'geometry_error', 'careless_error',
      'unanswered', 'other',
      'kanji_stroke_error', 'okurigana_error', 'reading_error',
      'grammar_particle_error', 'context_comprehension_error', 'word_choice_error',
      'alphabet_error', 'english_listening_error', 'english_word_error'
    )
  );

-- 4. 問題バンク由来の問題と、英語の聞き取り文
alter table public.problems
  add column if not exists curriculum_problem_id text;
create unique index if not exists problems_child_curriculum_unique
  on public.problems (child_id, curriculum_problem_id);
alter table public.generated_similar_problems
  add column if not exists listen_text text;
