# T006 Judge receipt — security boundary review (rejected) and W4 package (2026-09-02)

## Confirmed defects → T012 fix-up (PM executes)
- **S1 (high)** `app/api/child-mode/route.ts:34-40`: `DELETE /api/child-mode` clears the cookie without a PIN. Parent session == child session, so one `fetch('/api/child-mode',{method:'DELETE'})` restores parent access. Fix: delete the DELETE export entirely (pin/verify already clears the cookie); tests assert DELETE → 405; e2e case; doc.md §16 row. No NODE_ENV-gated variant.
- **D2b (medium)** `app/api/reviews/schedule/route.ts:72-95`: `countSimilarCorrect` keeps the LATEST attempt per similar problem → re-POST with the right choice inflates to 5/5; all generated sets in the session are merged (2/5+2/5=4). Fix: FIRST attempt per similar problem (created_at asc, keep first), scoped to the 5 most recent generated_similar_problems for (child, source_problem). Update tests.
- doc.md §15: record the 24h cookie expiry trade-off.

## Plausible (tracked)
- Cookie maxAge 24h silently restores parent access — accepted (PIN-forgotten recovery).
- /api/attempts, /api/sessions, /api/reviews/schedule have no rate limit → W5 DB rate limit on all mutating routes.
- Similar explanation text contains the answer — acceptable (shown after answering; card locks).
- Missing-Origin POST allowed — acceptable with SameSite=Lax cookies; W5 may add Sec-Fetch-Site.
- PIN lock/verify order, reset-on-success, hash never returned, admin client only — correct. In-process rate limit → W5.
- attempts POST 60 lines / LearningFlow 350 lines → W6.

## Verified OK
Encoded/case/slash path variants → 404/308, no bypass. 0010: no authenticated `from("users")` anywhere; trigger security definer; composite FKs backed by 0001 uniques; choices CHECK + pgTAP. RSC page selects only id/child_id/problem_text/unit. Tests strengthened, no skips. PM's Origin/Host fix correct; gate runs before updateSession.

## W4 Worker package (T007)
Objective: Gemini key → `x-goog-api-key` header; hand-written JSON Schema `responseSchema` for the 4 structured calls (lib/ai/responseSchemas.ts; enums generated from curriculum constants at runtime; test that required keys == Zod shape keys; similar/hints use GEMINI_STRUCTURED_MODEL kind 'structured'). analyze-problem validates per item, saves valid ones, returns `{saved, failed}`. `lib/ai/pii.ts` `scrubPii(text)` pure: 学校名 `[^\s、。]{1,10}(小学校|小|中学校)` / 先生 `[^\s、。]{1,6}先生` / クラス `\d年\d組|\d組` (『2年生』 must NOT match — explicit test) / 氏名 `(なまえ|名前|氏名)[:：]\s*\S+` / 住所 都道府県+市区町村 → replace with '〇〇'; applied after Zod, before insert, to problem_text/hints/explanation/similar problems. 0011: `increment_ai_usage(p_user uuid, p_cost numeric, p_call_limit int, p_cost_limit numeric) returns (allowed bool, calls int, cost_usd numeric)` security definer single-statement upsert with condition; reserve BEFORE the provider call; denied → 429; no refund on provider failure; RPC error → 503 fail-closed. `app_settings.enable_image_generation` (default false; settings GET/PATCH expose it). recognize-handwriting: `data` max 2_000_000 chars, decode prefix and require PNG/JPEG/WEBP magic matching mimeType (400). generate-hints: with explanationLevel, regenerate via `provider.generateHints(buildHintsPrompt)` through the RPC, hintsSchema + PII, not persisted, return only ≤ max_level; add generateHints to mock. generate-image: template first (grade2Math.visualTemplate → /visuals/<t>.svg, 11 SVGs; replace volume-l-ml.svg with volume.svg after `ls`); else 4-condition gate (recommendedVisualTemplate null && requestedByChild && enable_image_generation && RPC allowed) → `lib/ai/image.ts` GPT Image call (IMAGE_GENERATION_MODEL / OPENAI_API_KEY; missing → 503); return data URL, never persist.

allowed_files: lib/ai/{gemini,responseSchemas,prompts,index,provider,mock,schemas,usage,costGuard,pii,image,buildProblemRecords}.ts, lib/curriculum/grade2Math.ts, app/api/ai/*/route.ts, app/api/settings/[childId]/route.ts, components/parent/SettingsForm.tsx, supabase/migrations/0011_ai_hardening.sql, supabase/tests/rls_isolation.sql, types/database.ts, public/visuals/*.svg, .env.example, doc.md, tests/ai/*, tests/api/ai-*.test.ts, tests/security/ai-hardening-migration.test.ts, tests/curriculum/visuals.test.ts.
verify: typecheck, lint, vitest, build, `grep -n 'key=' lib/ai/gemini.ts` → 0, `grep -n 'volume-l-ml\|templates\[' app/api/ai/generate-image/route.ts` → 0, `ls public/visuals/*.svg | wc -l` → 11, `grep -rn scrubPii app/api lib/ai` → referenced from analyze/similar/hints paths.
stop_if: outside allowed_files (never touch child-mode/hint/proxy/attempts); GPT Image response format unknown → leave lib/ai/image.ts as a 503 stub and record; RPC semantics not expressible in one statement; verify fails twice.

## W6 leftovers added
attempts POST / LearningFlow split; re-arm child cookie after 24h expiry when visiting /child/* with a PIN set; rate limit on attempts/sessions/schedule (after W5).
