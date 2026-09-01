# CLAUDE.md

小学校2年生向け 個別最適化AI算数学習アプリ(かのはアプリ)。
仕様は `doc.md`、実装計画とフェーズ順序は `implement.md` を必ず参照すること。

## プロジェクト概要

- 親が問題画像(プリント/スクショ/教科書/手書き回答)をアップロード → Gemini が解析 → 子どもが段階式ヒント(ヒント1→ヒント2→解き方→答え)で学習 → 類題5問(4/5で「できた」) → 苦手単元マップ・復習スケジュール(1/3/7日後) → 親へSlack日次レポート
- 子どもは独自ログインなし。親セッション内の「子どもモード」として動作する

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + PWA
- Supabase (Auth / Postgres / Storage)、全テーブル・StorageでRLS必須
- AI: テキスト・画像解析・構造化は **Gemini**、図解の画像生成のみ **GPT Image系**
- テスト: Vitest(ユニット/コンポーネント) + Playwright(E2E)

## 鉄則

### AI関連

- **モデル名をコードに直書きしない。** 必ず環境変数(`GEMINI_TEXT_MODEL` 等)経由
- AI呼び出しは `lib/ai/` のラッパー経由のみ。Route Handler から SDK を直接叩かない
- AI出力は必ず `lib/ai/schemas.ts` の **Zodスキーマで検証してから保存**。検証失敗は保存せず status=failed
- 単元判定は `lib/curriculum/grade2Math.ts` の定数リストへの分類に限定(AIに自由記述させない)
- プロンプトは `lib/ai/prompts.ts` に集約
- 開発・テスト時は `AI_PROVIDER_TEXT=mock` でモック(`lib/ai/mock.ts`)を使う
- 画像生成は条件付き(テンプレ不可 + 子どもが要求 + 親が許可 + コスト上限内)。`lib/ai/costGuard.ts` を必ず通す

### セキュリティ・プライバシー(このアプリ固有)

- **保存禁止**: 学校名・先生名・クラス名・本名・住所。解析プロンプトでも出力させない
- 子どもは「ニックネーム」のみ。AI APIキーはサーバー側のみ(クライアントバンドル混入禁止)
- Slack Webhook URL は `app_settings` に暗号化保存。APIレスポンスでクライアントに返さない
- 生成音声・生成解説画像は保存しない。問題画像は `expires_at` で期限削除
- 全APIで: Zod入力検証 → セッション確認 → **child_id の所有確認**(`child_profiles.user_id = auth.uid()`)
- ログに画像URL・回答全文・Webhook URLを出さない

### DB

- スキーマ変更は必ず `supabase/migrations/` にマイグレーションとして追加
- 新テーブルには必ずRLSポリシーを同時に作成し、RLS検証テストを書く
- `daily_limit_minutes` の正は `app_settings`(child_profiles には持たせない)
- `attempts` は `problem_id` / `similar_problem_id` のどちらか一方必須(CHECK制約)
- `weakness_map` は `(child_id, unit, sub_unit)` で upsert、`parent_reports` は `(child_id, report_date)` で冪等

### 子どもUI

- 答えを最初に表示しない。ヒントは押下時のみ段階開示(これを壊す変更は禁止)
- 子ども向け文言は ひらがな中心 + 漢字には `RubyText` コンポーネントでルビ
- 否定しない。間違えても励ます文言にする
- 音声は手動再生のみ(自動再生禁止)。Web Speech API は機能検出してフォールバック

## コーディング規約

- イミュータブル徹底(ミューテーション禁止)、関数は50行以内、ファイルは800行以内(目安200-400)
- API レスポンスは共通 `ApiResponse<T>` 形式(`{ success, data?, error? }`)
- ロジック(`lib/review/*` 等)は純粋関数で書き、TDD(テスト先行・カバレッジ80%+)
- `console.log` 禁止。エラーは握りつぶさず、ユーザー向けメッセージに内部情報を漏らさない
- コミットは conventional commits(`feat:` `fix:` など)

## ディレクトリ規約(doc.md §22)

- `app/child/*` 子ども画面 / `app/parent/*` 親画面 / `app/api/*` Route Handlers
- `components/child/*` `components/parent/*` に分離
- `lib/ai/` AI層 / `lib/review/` 復習・おすすめロジック / `lib/curriculum/` 単元マスタ
- テンプレ図解画像は `public/visuals/`

## コマンド(セットアップ後に有効)

```bash
npm run dev          # 開発サーバー
npm run build        # ビルド(コミット前に必ず通す)
npm run test         # Vitest
npm run test:e2e     # Playwright
npm run lint         # ESLint
```

## 現在の状態

- Phase 1〜7 の骨格は実装済み(2026-09-01 の設計レビューで中核ループの結線不備を多数検出)
- 現在は `docs/goals/kanoha-v01-complete/`(GoalBuddy ボード)に沿って修復・完成作業中。設計判断 A1〜A5 と欠陥リスト B1〜B15 は同ディレクトリの `goal.md` が正
- 単元・間違え方分類の正は `lib/curriculum/*`、日付は `lib/utils/date.ts`(Asia/Tokyo)のみを使う。`AI_PROVIDER_TEXT` は本番で必須
