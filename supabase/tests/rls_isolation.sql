begin;

create extension if not exists pgtap;
select plan(13);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'parent-one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'parent-two@example.test');

insert into public.child_profiles (id, user_id, nickname)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'one'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'two');

insert into public.learning_sessions (id, child_id)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');

insert into public.problems (id, child_id, problem_text, unit, sub_unit, correct_answer)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1Lは何mLですか。', '水のかさ', 'LとmL', '1000mL'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '1Lは何mLですか。', '水のかさ', 'LとmL', '1000mL');

insert into public.problem_hint_views (child_id, problem_id, session_id, max_level)
values
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1);

update public.users
set parent_pin_hash = 'scrypt$00$00', parent_pin_failed_attempts = 2
where id = '00000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.child_profiles),
  1::bigint,
  'a parent sees only owned child profiles'
);

select is(
  (select count(*) from public.learning_sessions),
  1::bigint,
  'a parent sees only owned child-scoped rows'
);

select throws_ok(
  $$insert into public.learning_sessions (child_id)
    values ('10000000-0000-0000-0000-000000000002')$$,
  '42501',
  null::text,
  'a parent cannot insert rows for another parent child'
);

select is(
  (
    with updated as (
      update public.child_profiles
      set nickname = 'not-owned'
      where id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*) from updated
  ),
  0::bigint,
  'a parent cannot update another parent child'
);

select throws_ok(
  $$select * from public.recompute_weakness(
    '10000000-0000-0000-0000-000000000002', 'たし算', 'くり上がり')$$,
  'child profile not found',
  'recompute_weakness refuses another parent child'
);

select lives_ok(
  $$select * from public.recompute_weakness(
    '10000000-0000-0000-0000-000000000001', 'たし算', 'くり上がり')$$,
  'recompute_weakness upserts an owned child unit row'
);

select is(
  (select count(*) from public.problem_hint_views),
  1::bigint,
  'a parent sees only owned problem_hint_views rows'
);

select throws_ok(
  $$insert into public.problem_hint_views (child_id, problem_id, session_id, max_level)
    values ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002',
            '20000000-0000-0000-0000-000000000002', 2)$$,
  '42501',
  null::text,
  'a parent cannot record hint views for another parent child'
);

select throws_ok(
  $$select parent_pin_hash from public.users$$,
  '42501',
  null::text,
  'authenticated cannot read parent_pin_hash'
);

select throws_ok(
  $$update public.users set parent_pin_failed_attempts = 0
    where id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  null::text,
  'authenticated cannot reset the PIN lockout counter'
);

select throws_ok(
  $$select * from public.increment_ai_usage(
    '00000000-0000-0000-0000-000000000002', 0.01, 100, 2.0)$$,
  'ai usage owner mismatch',
  'increment_ai_usage refuses another user id'
);

select throws_ok(
  $select count(*) from public.api_rate_limits$,
  '42501',
  null::text,
  'authenticated cannot read api_rate_limits directly'
);

select throws_ok(
  $select public.check_rate_limit('00000000-0000-0000-0000-000000000002:attempts', 10, 60)$,
  'rate limit key owner mismatch',
  'check_rate_limit refuses a key claiming another user'
);

select * from finish();
rollback;
