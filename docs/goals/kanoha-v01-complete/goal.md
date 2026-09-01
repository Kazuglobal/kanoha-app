# かのはアプリ v0.1 完成(設計レビュー指摘の改善)

## Objective

2026-09-01 の設計レビューで確定した指摘(設計判断 A1〜A5、実装欠陥 B1〜B15)を解消し、`doc.md` §24 の v0.1 最小構成
「親ログイン → 子どもプロフィール → 画像アップロード → Gemini解析 → 問題保存 → 子どもホーム → 今日のおすすめ問題 → ヒント表示 → 類題5問 → 正誤保存 → 苦手単元保存 → 復習予定保存 → Slack通知」
が **実 Supabase / Gemini / Slack に接続した状態で1周する** ところまでアプリを完成させる。

## Original Request

「設計の指摘を改善してアプリを最後まで作成するゴールを設定して」(直前のターンの設計レビュー結果を前提とする)

## Intake Summary

- Input shape: `existing_plan`(レビュー結果 = 検証済みの欠陥リストが実質の計画)
- Audience: 開発者本人(親)と、実際に使う小2の子ども
- Authority: `approved`(ユーザーが4つの設計判断を選択済み。外部公開・push・デプロイ・DB破壊操作は都度確認)
- Proof type: `demo` + `test`
- Completion proof: (1) `npm run typecheck` / `lint` / `test` / `build` 全緑 (2) Playwright E2E で「答えが初期表示されない」「子どもモードから /parent/* に入れない」「類題5問→4/5でできた」が通る (3) 実環境で v0.1 ループを1周し、`review_schedule` / `weakness_map` / `parent_reports` に正しい行が入り Slack が届いた実ログがある
- Likely misfire: テストが緑になっただけで「動く」と誤認する(レビュー B2/B3 のように、テスト済みロジックが本番から未参照のまま残る)。個別バグ修正に終始して中核ループの結線(attempts→weakness→review→report)を通さない。
- Blind spots considered: 実キーが無いと最終工程がブロックされる(`.env` 不在を確認済み)/ 親PIN は `users` への新カラム+マイグレーションが必要 / 段階開示をサーバー化すると `LearningFlow` の状態管理と E2E を作り直す必要がある / JST 統一は既存データの日付解釈を変える
- Existing plan facts: 下記「設計判断」「欠陥リスト」を保持し、各 Worker パッケージの前に Judge が allowed_files・verify・stop_if を確定する

## 設計判断(ユーザー決定済み・変更不可)

- **A1 子どもモード**: モードcookie(`kanoha_mode=child`)+ 親PIN(4桁、`users` にハッシュ保存)。cookie が立っている間は `proxy.ts` が `/parent/*` を `/child/home` へリダイレクト。PIN 入力で解除。子ども画面から親画面へのリンクは撤去
- **A2 答えの秘匿**: サーバー側で段階開示。初期表示は問題文+選択肢のみ。ヒントは `POST /api/problems/[id]/hint { level }` で1段ずつ取得し、`hint_level_used` はサーバーで記録。類題の選択肢もサーバー側で生成・検証
- **A3 タイムゾーン**: アプリ全体の「今日」「report_date」「scheduled_for」は **Asia/Tokyo** 基準。共通ヘルパ1つに集約
- **A4 間違え方分類**: 正は `lib/curriculum/mistakeTypes.ts`(13種)。Zod・DB CHECK・doc.md §10 をそれに揃える。AI診断の mistakeType を attempts まで伝搬させる
- **A5 単元マスタ**: 正は `lib/curriculum/grade2Math.ts`。`lib/ai/index.ts` の重複リストを廃止し、Zod enum + DB CHECK で強制。doc.md §11 を更新
- **完了条件**: 実環境接続まで含める。キー未提供の工程はブロック扱いで報告し、ローカルで進められる作業は止めない

## 欠陥リスト(レビュー B1〜B15、file:line は 2026-09-01 時点)

1. `review_schedule` に UNIQUE(child_id, problem_id) が無く upsert が常に失敗(`app/api/reviews/schedule/route.ts:34`)
2. `weakness_map` の accuracy を1問分で単元行に上書き(`app/api/attempts/route.ts:52-69`)。`lib/review/weakness.ts` 未参照
3. 「同じ間違い連続→難易度を下げる」未実装(`lowerDifficultyForRepeatedMistake` 未参照)
4. `review_schedule.status` が pending から遷移しない。`currentStage` 未伝搬
5. 日次レポートが固定文スタブ(`app/api/reports/slack/route.ts:38-46`)、pg_cron 日次ジョブ無し
6. `AI_PROVIDER_TEXT ?? "mock"` が本番既定(`lib/ai/index.ts:65`)
7. 利用時間制限が無効(`app/api/sessions/route.ts:20-26`、`duration_seconds` クライアント値、途中終了なし)
8. 「もっとかんたんに」が無効(`app/api/ai/generate-hints/route.ts`、`buildHintsPrompt` 未使用)
9. 「絵で教えて」の4条件のうち1つのみ実装、テンプレ1枚、キー不一致(かさ/capacity)
10. コストガード fail-open・非アトミック(`lib/ai/usage.ts`)、`rateLimit.ts` がプロセス内 Map
11. PII 除去がプロンプト依存のみ(後段フィルタ無し)
12. Gemini `responseSchema` 未使用、`GEMINI_STRUCTURED_MODEL` 未使用、API キーが URL クエリ
13. 類題の選択肢をクライアント生成(`LearningFlow.tsx:42-54`)
14. `PATCH /api/settings/[childId]` が `slack_webhook_secret_id` を返す
15. `recognize-handwriting` の base64 上限なし、`unit`/`problemText` に max なし、`supabase-js: "latest"`、lockfile 未コミット、セキュリティヘッダー無し
- UI付随: `SimilarProblemCard` や固定文言が `RubyAuto` を通らない、「もう一回やる」不在、進捗が useState のみ、`VoiceButton` に onerror 無し、E2E が DemoHome しか通っていない、`HintStepper` のかさ固定フォールバック文

## Goal Kind

`existing_plan`

## Current Tranche

継続実行。Judge が各パッケージの allowed_files / verify / stop_if を確定 → Worker がパッケージ全体を実装・検証 → 中核ループとセキュリティ境界の2箇所でのみ Judge レビュー → 最終監査で実環境1周を確認するまで止まらない。

パッケージ順序(縦切り、各々が動く状態で終わる):
W1 基盤整合(enum/単元/JST/モック既定/マイグレーション) → W2 学習中核ループ結線 → [Judge] → W3 子どもモード+段階開示 → [Judge] → W4 AI層堅牢化 → W5 レポート/Slack/セキュリティ → W6 子どもUI仕上げ+E2E → W7 実環境検証 → [最終監査]

## Non-Negotiable Constraints

- `CLAUDE.md` の鉄則(モデル名直書き禁止、AI は `lib/ai/` 経由、Zod 検証後のみ保存、答えを最初に出さない、否定しない文言、音声自動再生禁止、PII 保存禁止、全API で Zod→セッション→child 所有確認)
- スキーマ変更は必ず `supabase/migrations/` に追加(既存ファイルの書き換え禁止)。新テーブル/カラムには RLS と検証テスト
- イミュータブル、関数50行、ファイル800行、`console.log` 禁止
- 検証を通すための skip・削除・アサーション弱体化・catch 握りつぶし禁止
- ファイル削除は `ls` で対象確認後、確認付きで行う。`rm -rf` の決め打ち禁止。Worker はその旨をプロンプトで受け取る
- 外部公開(push / PR / デプロイ / Slack 実送信以外の外部送信)と課金を伴う操作は着手前にユーザー確認
- 実キー(`.env`)はユーザーが用意する。Worker が推測で書かない

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker package when the broader owner outcome still has safe local follow-up work.

Do not create one Worker/Judge pair per repeated file, table, route, or helper. Put repeated same-shape work into one Worker package and review the package as a whole.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny. A Worker finishes the whole assigned package (W1〜W7 の1つ)。2連続で tiny task になったら PM がボードを組み直す。

実キー・外部送信・破壊的操作が必要な工程はその task だけをブロックし、受領証に「何が必要か」を書いて、残りのローカル作業を続ける。

## Canonical Board

`docs/goals/kanoha-v01-complete/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins.

## Run Command

```text
/goal Follow docs/goals/kanoha-v01-complete/goal.md.
```

## PM Loop

1. Read this charter. 2. Read `state.yaml`. 3. Update checker(あれば)。 4. Re-check intake(設計判断 A1〜A5 を再確認)。 5. Work only on the active task. 6. Assign Scout / Judge / Worker / PM per task. 7. Write a compact receipt. 8. Update the board. 9. If safe local work remains, activate the next Worker package. 10. Review only at the two marked boundaries and final audit. 11. Finish only with an audit receipt recording `full_outcome_complete: true`.
