# T004 Judge receipt — core-loop review (rejected) and W3 package (2026-09-02)

## Confirmed defects → T011 fix-up
- **D1 mastery flip-flop** (`0009_learning_loop.sql:316-320`, `lib/review/loop.ts:29-44`, `app/api/reviews/schedule/route.ts:56-78`): 4/5 similar set sets `mastered` via the schedule route, but the next attempt in the unit runs the RPC whose `on conflict ... set mastery_level = excluded.mastery_level` overwrites it back to `reviewing`. Fix: sticky mastery in the upsert (`case when excluded='mastered' or existing='mastered' then 'mastered' else excluded end`; demotion only via `masteryAfterSimilarSet` < 4/5); `recomputeWeakness` returns the DB row's mastery as truth; `updateWeakness` keeps `mastered` sticky; guard `nullif(attempt_count,0)`; tests for the sticky clause and mastered→stays-after-wrong.
- **Open-session uncapped** (`lib/sessions/dailyLimit.ts:20-26`): a tab closed at minute 1 blocks the whole day after 15 min. Fix (pure function): open session counts `min(now, max(last attempt created_at in session, started_at) + 10 min grace) − started_at`; `loadDailyLimit` / `today.ts` pass a last-attempt-per-session map (one extra attempts query by session_id). W6 still adds resume/close.
- **PM design call** (plausible item): reviews/schedule currently creates a pending review for every completed set even if the original was never wrong. doc §12.1 says only wrong problems. Decision: schedule route only creates/updates a review when a pending review already exists OR the original attempt in that session was wrong; 5/5 with no existing review → no row.

## D2 (assigned to W3)
`similarCorrectCount` is client-claimed (`lib/sessions/complete.ts:53-58`, `app/api/reviews/schedule/route.ts:9-12`) and the client holds every similar answer. W3: derive it server-side from attempts; strip answer/explanation from the generate-similar response.

## Decisions recorded
- 0009 has never been applied to any DB → amending 0009 in place for the fix-up is acceptable (no 0011). Future migrations after real `db push` are append-only.
- 0008's `attempts_mistake_type_check` matches Postgres' auto-name for 0001's inline CHECK → exactly one CHECK remains. Correct.
- 5/5 → stage+1 (max 3) is the faithful reading of doc §12.2; the old test expectation (jump to 3) was wrong.
- JST date.ts correct across 15:00 UTC. SQL 0009 security posture correct.
- T005 uses migration **0010** (0009 exists).

## Other plausible (tracked, not blocking)
- Limit-stop path in LearningFlow closes the session but never calls `completeLearningSession` (no review/Slack for the partial session) → W5 cron covers the report; W6 hand-off.
- React StrictMode dev double-runs POST /api/sessions → 2 open sessions per page in dev → W6 resume/close.
- `LearningFlow.tsx` 356 lines, pre-existing → W6 split.

## W3 Worker package (T005)
See state.yaml T005 for allowed_files/verify/stop_if. Objective summary:
1. **0010 migration**: `users.parent_pin_hash text`, `parent_pin_failed_attempts smallint default 0`, `parent_pin_locked_until timestamptz` (revoke select on those columns from authenticated/anon after grep confirms no `select('*')` on users; else fall back to explicit column selects and record it). New table `problem_hint_views(child_id, problem_id, session_id, max_level 0-4, updated_at; PK child_id+problem_id+session_id; FKs; RLS owns_child)`. `generated_similar_problems.choices jsonb null`. pgTAP cases in rls_isolation.sql.
2. **PIN** `lib/auth/pin.ts`: Node crypto scrypt (N=16384, 16-byte salt, `scrypt$salt$hash`, timingSafeEqual). `POST /api/parent/pin` (session, 4 digits Zod). `POST /api/parent/pin/verify` → success clears child cookie; 5 failures → locked 5 min (admin client for those columns; never return the hash).
3. **Child mode** `POST /api/child-mode` sets `kanoha_mode=child` (httpOnly, sameSite=lax, path=/, secure in production, maxAge 24h, unsigned — forging only lowers privilege). `lib/auth/childMode.ts` exports `isChildMode(cookies)` + `PARENT_ONLY_API` prefixes. `proxy.ts`: with child cookie, `/parent/*` → 302 `/child/home`; parent-only API → 403 JSON. Parent-only: `/api/children*`, `/api/materials*`, `/api/ai/analyze-problem`, `/api/settings/*`, `/api/parent/pin` (set), `POST /api/child-mode`. Child-allowed: attempts, sessions*, reviews/schedule, recommendations/today, ai/generate-hints, ai/generate-similar-problems, ai/generate-image, ai/recognize-handwriting, problems/[id]/hint, reports/slack, `DELETE /api/child-mode` + pin/verify. Remove `/parent` links from ChildHeader and child home.
4. **Hint API** `POST /api/problems/[id]/hint {childId, sessionId, level 1-4}`: level ≤ max_level+1 else 400; upsert max_level; return only that level's text; demo problem served from `lib/ai/mock.ts` when Supabase unconfigured. `/api/attempts` ignores client hintLevelUsed and reads max_level; wrong answers reveal nothing. generate-hints returns only levels ≤ max_level. `app/child/problem/[id]/page.tsx` passes only question/unit/ids; HintStepper fetches per level; LearningFlow judges from the attempts response.
5. **Choices** `lib/review/choices.ts` pure `buildChoices(answer, seed)`: numeric+suffix answers → 3 unit-consistent unique distractors, deterministic shuffle; non-parsable → `choices: null` and SimilarProblemCard falls back to text input. Persist at generation; generate-similar response drops answer/explanation; `/api/attempts` validates tap answers against stored choices and returns the explanation on wrong answers; delete `makeChoices`. reviews/schedule derives similarCorrectCount server-side (D2).
6. Tests + E2E (`e2e/child-mode.spec.ts`, updated `child-learning.spec.ts`).

E2E assertions: raw HTML / page.content() of the demo problem contains no answer and no hint text; hints appear only per press in order, answer only at level 4; with the child cookie `/parent/settings` → 302 `/child/home`, `POST /api/children` → 403, no `/parent` hrefs on child pages; without cookie `/parent/settings` reachable; similar cards show exactly 4 unique choices; 4/5 → できた. PIN set/verify E2E needs a seeded user → vitest route tests in W3, Playwright in W6.

## W6 leftovers
Session resume/close (sessionStorage, PATCH on visibilitychange, retry button); もう一回やる; RubyAuto for SimilarProblemCard and fixed strings; HintStepper かさ fallback; 絵で教えて from hint 2; seeded-user Playwright (PIN → child mode → unlock, full real-route loop); DemoHome 'かさ' strings; LearningFlow split; VoiceButton onerror; StrictMode double session start; partial-session hand-off.
