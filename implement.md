# 実装計画書(implement.md)

# 小学校2年生向け 個別最適化AI算数学習アプリ

> 仕様は `doc.md`、開発規約は `CLAUDE.md` を参照。
> 本書は「何を・どの順で・どこまでやったら完了か」を定義する。**このドキュメント時点では未実装。**

---

## 0. 全体方針

- **フェーズは縦に薄く切る**: 各フェーズの終わりに「動くもの」がある状態を保つ
- **AIはモックから始める**: Phase 1〜3 はモックAIレスポンス(`lib/ai/mock.ts`)で画面とDBを先に完成させ、Phase 4 で実APIに差し替える
- **TDD**: ロジック(復習スケジュール・おすすめ選定・Zodスキーマ・weakness集計)はテスト先行。UIはコンポーネントテスト、主要フローはE2E
- **各フェーズ完了時にコミット + code-reviewer / security-reviewer エージェントでレビュー**

### フェーズ依存関係

```text
Phase 1(基盤) → Phase 2(DB/RLS) → Phase 3(子ども学習画面: モックAI)
                                  ↘ Phase 4(AI実連携)
Phase 3 + 4 → Phase 5(個別最適化) → Phase 6(親機能/Slack) → Phase 7(体験強化)
```

---

## Phase 1: プロジェクト基盤

### タスク

| # | タスク | 成果物 |
|---|---|---|
| 1-1 | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui セットアップ | `package.json`, `app/layout.tsx` |
| 1-2 | Vitest + Testing Library + Playwright 導入 | `vitest.config.ts`, `playwright.config.ts` |
| 1-3 | `.env.example` 作成(doc.md §21 の全変数) | `.env.example` |
| 1-4 | Supabase プロジェクト接続(client / server / middleware) | `lib/supabase/*` |
| 1-5 | Supabase Auth: 親のサインアップ・ログイン・ログアウト | `app/login/`, `middleware.ts` |
| 1-6 | 型定義の骨格 | `types/*.ts` |
| 1-7 | 共通 `ApiResponse<T>` とエラーハンドリングユーティリティ | `lib/utils/api.ts` |

### 完了条件(DoD)

- `npm run dev` で起動し、親がサインアップ→ログイン→ログアウトできる
- 未ログインで `/parent/*` `/child/*` にアクセスすると `/login` にリダイレクト
- `npm run test` / `npm run build` が通る

---

## Phase 2: DBスキーマ + RLS

### タスク

| # | タスク | 成果物 |
|---|---|---|
| 2-1 | 全11テーブルのDDL(doc.md §14。変更点①〜⑫反映) | `supabase/migrations/0001_schema.sql` |
| 2-2 | `auth.users` → `public.users` 自動作成トリガー | 同上 |
| 2-3 | 全テーブルのRLSポリシー(doc.md §15) | `supabase/migrations/0002_rls.sql` |
| 2-4 | Storageバケット `materials` + RLSポリシー | `supabase/migrations/0003_storage.sql` |
| 2-5 | pg_cron: 期限切れ画像削除ジョブ | `supabase/migrations/0004_cron.sql` |
| 2-6 | 単元マスタ・間違え方マスタ | `lib/curriculum/grade2Math.ts`, `mistakeTypes.ts` |
| 2-7 | 子どもプロフィール CRUD(親画面) | `app/parent/settings/` |

### 完了条件

- マイグレーションが冪等に適用できる
- **RLS検証テスト**: 別アカウントのデータが SELECT できないことをテストで確認
- 親が子どもプロフィールを複数作成・編集・削除できる

---

## Phase 3: 子ども学習画面(モックAI)

> AIは `lib/ai/mock.ts` の固定レスポンス(ParsedProblem / ヒント / 類題5問)を使用。
> UI先行で学習ループ全体を完成させる。

### タスク

| # | タスク | 成果物 |
|---|---|---|
| 3-1 | モックAIレスポンス(かさ・たし算・九九の3問ぶん) | `lib/ai/mock.ts` |
| 3-2 | 子どもホーム画面(キャラ・「はじめる/ふくしゅう/もういちど」大ボタン・がんばりメーター) | `app/child/home/`, `components/child/*` |
| 3-3 | 問題画面(問題表示・回答入力: タップ選択/数字入力) | `app/child/problem/[id]/` |
| 3-4 | HintStepper(ヒント1→2→解き方→答え。押したときだけ開示) | `components/child/HintStepper.tsx` |
| 3-5 | 類題画面(1問ずつ・正誤フィードバック・4/5判定) | `components/child/SimilarProblemCard.tsx` |
| 3-6 | 結果画面(正答率・できた単元・ほめコメント・ごほうび演出) | `app/child/result/` |
| 3-7 | RubyText コンポーネント(漢字+ルビ) | `components/child/RubyText.tsx` |
| 3-8 | 音声読み上げ(Web Speech API、手動再生) | `components/child/VoiceButton.tsx` |
| 3-9 | `POST /api/attempts`(セッション・回答保存) | `app/api/attempts/` |
| 3-10 | E2E: ホーム→問題→ヒント→類題5問→結果 の一連フロー | `e2e/child-learning.spec.ts` |

### 完了条件

- 子どもがホームから問題→ヒント→類題5問→結果まで1人で完走できる(モックデータ)
- 答えが最初に表示されない。ヒントは押下時のみ開示(E2Eで検証)
- attempts / learning_sessions に正しく記録される
- 4/5正解で「できた」、3/5以下で励まし表示

---

## Phase 4: AI実連携(Gemini)

### タスク

| # | タスク | 成果物 |
|---|---|---|
| 4-1 | Gemini APIラッパー(モデル名はenv、リトライ・タイムアウト付き) | `lib/ai/gemini.ts` |
| 4-2 | AI出力のZodスキーマ(ParsedProblem / Hints / SimilarProblems) | `lib/ai/schemas.ts` |
| 4-3 | プロンプト集約(解析・ヒント・類題・レポート) | `lib/ai/prompts.ts` |
| 4-4 | 画像アップロードAPI(複数ページ→Storage→uploaded_materials) | `app/api/materials/upload/` |
| 4-5 | 親アップロード画面 | `app/parent/upload/` |
| 4-6 | `POST /api/ai/analyze-problem`(Vision解析→個人情報除去→problems保存。失敗時 status=failed) | `app/api/ai/analyze-problem/` |
| 4-7 | `POST /api/ai/generate-hints`(「もっとかんたんに」= explanationLevel 変更再生成) | `app/api/ai/generate-hints/` |
| 4-8 | `POST /api/ai/generate-similar-problems` | `app/api/ai/generate-similar-problems/` |
| 4-9 | コストガード(日次呼び出し回数/コスト上限) + AI系レート制限 | `lib/ai/costGuard.ts` |
| 4-10 | 「絵で教えて」: テンプレ画像表示 + `POST /api/ai/generate-image`(条件付き) | `public/visuals/`, `app/api/ai/generate-image/` |
| 4-11 | モック⇔実APIの切り替え(`AI_PROVIDER_TEXT=mock` で開発・テスト時はモック) | `lib/ai/index.ts` |

### 完了条件

- 実プリント画像をアップロード→解析→問題として子ども画面に出る
- AI出力はすべてZod検証を通過したものだけ保存される(不正JSONは保存されない)
- 解析失敗が親画面に表示され、再実行できる
- APIキーがクライアントバンドルに含まれない(`npm run build` 後に検証)
- ユニットテスト: スキーマ検証・コストガード・プロンプト組み立て

---

## Phase 5: 個別最適化

### タスク

| # | タスク | 成果物 |
|---|---|---|
| 5-1 | weakness_map 更新ロジック(attempts保存時にupsert・accuracy再計算) | `lib/review/weakness.ts` |
| 5-2 | 復習スケジュールロジック(1/3/7日 + 類題結果調整。**純粋関数でTDD**) | `lib/review/schedule.ts` |
| 5-3 | `POST /api/reviews/schedule` | `app/api/reviews/schedule/` |
| 5-4 | 今日のおすすめ選定ロジック(doc.md §12.3 の優先順位。**純粋関数でTDD**) | `lib/review/recommend.ts` |
| 5-5 | `GET /api/recommendations/today` + ホーム画面接続 | `app/api/recommendations/today/` |
| 5-6 | 4/5習得判定 → mastery_level 更新 → 次回スケジュール調整の結合 | — |
| 5-7 | 「同じ間違いが連続」検出 → 難易度を下げた類題に差し替え | `lib/review/recommend.ts` |

### 完了条件

- 間違えた問題が翌日の「ふくしゅう」に出る
- 類題5/5 → 7日後、4/5 → 3日後、3/5以下 → 1日後 になる(ユニットテストで全分岐検証)
- おすすめ問題が復習予定 > 苦手単元 > 未学習の優先順で選ばれる
- ロジック層のカバレッジ80%以上

---

## Phase 6: 親機能 + Slack

### タスク

| # | タスク | 成果物 |
|---|---|---|
| 6-1 | 親ダッシュボード(doc.md §6.4 の表示順で8項目) | `app/parent/dashboard/` |
| 6-2 | 学習履歴詳細(問題ごとの正誤・ヒント使用レベル・間違え方) | 同上 |
| 6-3 | 設定画面(AI説明レベル・利用時間制限・Slack設定・画像削除) | `app/parent/settings/` |
| 6-4 | Slack Webhook URL の暗号化保存(Vault/pgsodium) | migration + `app/api/` |
| 6-5 | 日次レポート生成(Gemini)+ `parent_reports` 保存(UNIQUE で冪等) | `lib/slack/sendReport.ts` |
| 6-6 | `POST /api/reports/slack`(自動: セッション終了時 / 手動ボタン) | `app/api/reports/slack/` |
| 6-7 | 利用時間制限の実装(セッション累計が上限到達でやさしく終了誘導) | `app/child/` |

### 完了条件

- 親がダッシュボードで8項目すべてを確認できる
- 学習完了後にSlack通知が届き、同日2回目は送信されない
- Webhook URL がクライアントに返らない(APIレスポンス検証)
- 利用時間制限が機能する(問題の途中では切らない)

---

## Phase 7: 体験強化(MVP仕上げ)

### タスク

| # | タスク | 成果物 |
|---|---|---|
| 7-1 | 音声回答(Web Speech API SpeechRecognition、失敗時フォールバック) | `components/child/VoiceAnswer.tsx` |
| 7-2 | キャラクターコーチの表情・セリフバリエーション | `components/child/CharacterCoach.tsx` |
| 7-3 | Framer Motion でごほうび演出・画面遷移 | — |
| 7-4 | PWA対応(manifest / アイコン / オフライン表示) | `public/manifest.json` |
| 7-5 | 手書き入力(canvas → Gemini判定) ※時間があれば | `components/child/HandwritingPad.tsx` |
| 7-6 | アクセシビリティ・実機確認(タブレット/スマホ) | — |

### 完了条件

- doc.md §23 の受け入れ条件をすべて満たす
- 実際の家庭利用(娘さんによる15分学習)が1サイクル回る

---

## テスト戦略まとめ

| 層 | ツール | 対象 | 方針 |
|---|---|---|---|
| ユニット | Vitest | `lib/review/*`, `lib/ai/schemas.ts`, `lib/ai/costGuard.ts`, `lib/utils/*` | TDD・全分岐・80%+ |
| コンポーネント | Vitest + Testing Library | HintStepper(段階開示), RubyText, SimilarProblemCard(4/5判定) | 振る舞い検証 |
| API | Vitest | Route Handlers(Zod検証・認可・冪等性) | Supabaseはモック |
| RLS | SQL/統合テスト | 他アカウントのデータ遮断 | Phase 2 で必須 |
| E2E | Playwright | 子ども学習フロー / 親アップロード→解析→学習 / Slack(モック) | クリティカルパスのみ |

## リスクと先回り対策

| リスク | 対策 |
|---|---|
| Gemini の解析精度(手書き・赤ペン) | Phase 4 冒頭に実プリント10枚でスパイク検証。精度不足なら「解析結果を親が修正できるUI」を6-2に追加 |
| AIコスト暴走 | costGuard を Phase 4 で最初に実装。上限超過時はモック/テンプレにフォールバック |
| 子どもUIの操作性 | Phase 3 完了時点で実機(タブレット)で娘さんテスト → フィードバックを Phase 7 に反映 |
| Web Speech API のブラウザ差 | 機能検出してボタン自体を非表示にするフォールバックを最初から実装 |
| 構造化出力の崩れ | responseSchema + Zod + リトライ1回。それでも失敗なら status=failed で人間にエスカレーション |
