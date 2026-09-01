# T001 Judge receipt — W1 package and hazards (2026-09-02)

## Defect verification
B1–B15 all confirmed at the cited locations. One correction: attempts.mistake_type CHECK in 0001 already equals the 13 curriculum ids; only Zod (7 values) and doc.md §10 diverge.

## W1 decisions
- Unit CHECK set (11, from grade2Math.ts): 表とグラフ, 時こくと時間, たし算, ひき算, 長さ, 水のかさ, 三角形と四角形, かけ算, 1000より大きい数, 分数, はこの形. sub_unit stays free text.
- Constraint names: `<table>_unit_check` (new), `review_schedule_child_problem_key` (new), `attempts_mistake_type_check` dropped and re-added with the same 13 ids so 0008 becomes the documented source. Difficulty checks untouched.
- `GRADE_2_MATH_UNITS` / `MISTAKE_TYPE_IDS` typed as non-empty tuples for `z.enum`.
- Provider default (`lib/ai/index.ts`): `AI_PROVIDER_TEXT ?? (NODE_ENV==='production' ? throw : 'mock')`.
- Mock units → 水のかさ/LとmL, たし算/くり上がり, かけ算/九九. `analyzeWithMock` uses mock provider's first problem. generate-image key → 水のかさ (full redesign in W4).
- `lib/utils/date.ts`: `todayKeyJst(now)`, `toJstDateKey(date)`, `addDaysJst(dateKey, n)`, `jstDayRange(now)`. `dailyLimit.tokyoDayRange` delegates. `schedule.addLocalDays` → `addDaysJst`.
- attempts / generate-similar `mistakeType` Zod → `z.enum(MISTAKE_TYPE_IDS)`.
- doc.md §8.2 sample: unit 水のかさ, mistakeType unit_conversion_error, recommendedVisualTemplate "volume"; §9 unit_confusion → unit_conversion_error.
- Max lengths: problemText 2000, unit/subUnit 50, answers 200, hint texts/explanation 1000, mistakeReason 500.

## Hazards
- `z.enum` on `.map()` result fails typecheck → tuple typing required.
- Enum tightening breaks the mock path at runtime unless mock.ts + analyzeWithMock are fixed in the same slice.
- Tests to update: tests/ai/schemas.test.ts (unit_confusion, かさ), buildProblemRecords.test (かさ), provider.test (['かさ','たし算','九九']).
- Demo-only 'かさ' strings in LearningFlow.tsx:242-243, child/result/page.tsx:9, child/home DemoHome, e2e spec → W6, not W1.
- sessions/route.ts imports `tokyoDayRange` — keep the export.
- Repo has zero commits; verify on working tree. package-lock.json stays untracked until W5.
- types/domain.ts Difficulty still pre-0007 values, unreferenced → align in W2 or W5.
- CLAUDE.md "現在の状態: 未実装" is stale → PM refresh after W1.
- W2 and W3 both edit LearningFlow.tsx → strictly sequential.

## W2 pre-shaped allowed_files
supabase/migrations/0009_learning_loop.sql (new: security definer RPC record_attempt with owns_child guard, atomic weakness upsert, review transition), supabase/tests/rls_isolation.sql, app/api/attempts/route.ts, app/api/reviews/schedule/route.ts, app/api/sessions/route.ts, app/api/sessions/[id]/route.ts, app/api/ai/generate-similar-problems/route.ts, app/api/recommendations/today/route.ts, lib/review/{weakness,schedule,today,recommend,loop(new)}.ts, lib/sessions/{dailyLimit,complete}.ts, lib/utils/resources.ts, lib/ai/schemas.ts, components/child/LearningFlow.tsx (limit check at similar boundary only), tests/review/*, tests/sessions/*, tests/api/learning-loop.test.ts (new), tests/security/learning-loop-migration.test.ts (new).
