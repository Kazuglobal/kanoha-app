# T999 final audit — not_complete (2026-09-02)

Verification rerun by the Judge: typecheck 0 errors, vitest 63 files / 417 passed, console.log 0, largest file useLearningFlow.ts 382 lines, no .skip/.only outside the env guard in e2e/real-loop.spec.ts. HEAD a4a5c1c at audit time; A4 fix landed afterwards as T013.

## Defect map
| id | status | evidence |
|---|---|---|
| A1 | resolved | proxy.ts:27-39, lib/auth/childMode.ts, pin/verify route (b851ab1, 937f722); e2e 302/403/no-DELETE |
| A2 | resolved | problem page selects only problem_text/unit; hint route upserts problem_hint_views; attempts reads hintMaxLevel (b851ab1) |
| A3 | resolved | lib/utils/date.ts todayKeyJst used by loop/today/reports; 0012 uses Asia/Tokyo (437d5a6) |
| A4 | partial → fixed in T013 | Zod enum + CHECK + attempts fallback existed, but buildProblemRecords.ts dropped mistakeType before insert → attempts.mistake_type always null. Fixed by buildProblemExplanation (commit after a4a5c1c) |
| A5 | resolved | defaultUnits gone; unitSchema from GRADE_2_MATH_UNITS; 0008 unit CHECK on 4 tables |
| B1 | resolved | 0008 unique(child_id, problem_id); loop.ts onConflict |
| B2 | resolved | attempts → recomputeWeakness → rpc recompute_weakness; sticky mastered (14a731f, a649757) |
| B3 | partial → live after T013 | wired via generate-similar → difficultyForNextSimilarSet; was inert because mistake_type was always null |
| B4 | resolved | loop.ts pending→done when due; schedule route passes currentStage |
| B5 | resolved | reports/slack builds from buildDashboard, claim/release slack_sent_at; 0012 generate_daily_reports cron 0 12 * * * |
| B6 | resolved | lib/ai/index.ts throws in production without AI_PROVIDER_TEXT |
| B7 | resolved | duration clamped server-side, counts from attempts, open-session grace, stop at similar boundary |
| B8 | resolved | generate-hints regenerates via buildHintsPrompt behind reserveAiUsage, capped at max_level |
| B9 | resolved | template-first with 11 SVGs; 4-condition gate; GPT Image data URL never persisted |
| B10 | partial (accepted) | increment_ai_usage + check_rate_limit fail-closed on 13 routes; 8 AI/PIN routes still use in-memory checkRateLimit — accepted for v0.1 (DB cost guard + PIN lockout cover them) |
| B11 | resolved | scrubPii on analyze / similar / hints before insert |
| B12 | resolved | x-goog-api-key header; responseSchema passed |
| B13 | resolved | buildChoices server-side, persisted; attempts validates tap answers |
| B14 | resolved | maskedSettings on GET and PATCH |
| B15 | resolved | handwriting 2M cap + magic bytes; TEXT_LIMITS; supabase-js pinned; CSP/headers |

## Acceptance checklist (doc.md §23)
Child: all six proven with mock provider + Playwright. Parent: login/profiles/upload/history true; Slack receipt false until T010. AI: Gemini analysis and mistake classification unproven against the real API (false until T010); similar problems and image gating true. Non-functional: RLS pgTAP never executed against a DB (false until T010); API keys not in client bundle true; unit tests true.

## Missing evidence
- notes/T010-real-run.md (real Supabase/Gemini/Slack loop)
- pgTAP supabase/tests/rls_isolation.sql executed against a database
- Gemini responseSchema exercised against the real API

## Owner decisions recorded
- B10 in-memory rate limit on the 8 AI/PIN routes: accepted for v0.1.
- Storage objects orphaned by DB-first material deletion: unreachable under storage RLS; accepted for a single household.
- DEMO_UNIT 'かさ' display string: accepted (demo only).
- next.config.ts turbopack.root '..': optional cleanup, not in scope.

## T010 procedure (once .env exists)
1. `.env`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_TEXT_MODEL, GEMINI_VISION_MODEL, GEMINI_STRUCTURED_MODEL, AI_PROVIDER_TEXT=gemini (optional OPENAI_API_KEY, IMAGE_GENERATION_MODEL, E2E_PARENT_EMAIL, E2E_PARENT_PASSWORD).
2. `supabase link` + `supabase db push` (0001–0012 in order).
3. Run supabase/tests/rls_isolation.sql with pgTAP (`supabase test db` or psql).
4. Seed parent + child + one analyzed problem; `npx playwright test e2e/real-loop.spec.ts`.
5. Manual: upload a real print → analyze → child mode loop → confirm review_schedule / weakness_map / parent_reports rows and Slack receipt → write notes/T010-real-run.md.
6. Re-audit (Judge) for `full_outcome_complete: true`.
