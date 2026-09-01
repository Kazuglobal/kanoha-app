begin;

create extension if not exists pgtap;
select plan(6);

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

select * from finish();
rollback;
