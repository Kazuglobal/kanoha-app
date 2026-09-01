# 開発仕様書(洗練版)

# 小学校2年生向け 個別最適化AI算数学習アプリ「かのはアプリ」

> 本書は初期仕様書を精査・洗練したものである。初期版からの主な変更点は末尾「付録A: 初期仕様からの変更点」を参照。
> 実装手順は `implement.md`、開発時の規約は `CLAUDE.md` を参照。

---

## 1. プロダクト概要

小学校2年生の子どもが、学校プリント・タブレットのスクショ・教科書・手書き回答の画像から学習できる、個別最適化型のAI算数学習アプリ。

AIがその子専用に以下を提供する。

- ヒント(段階式: ヒント1 → ヒント2 → 解き方 → 答え)
- 図解(テンプレ画像優先、必要時のみAI画像生成)
- 類題(5問、4/5正解で「できた」判定)
- 苦手単元マップと復習スケジュール
- 親向け日次レポート(Slack通知)

### 利用モデル

- **1つの親アカウント**に複数の**子どもプロフィール**がぶら下がる
- 子どもは独自のログインを持たない。**親のセッション内で「子どもモード」に切り替えて使う**
- 親は裏側で問題画像をアップロードし、学習履歴・苦手単元・復習予定を管理する
- 1日1回、15分程度の学習を想定

---

## 2. 解決したい課題

低学年の子どもは「どこが分からないのか」を自分で説明できないことが多い。
親が毎回、問題を見て・解説し・類題を作り・復習を管理するのは負担が大きい。

AIが自動化する処理:

| 処理 | 内容 |
|---|---|
| 画像解析 | 問題文・図・選択肢・手書き回答・途中式・赤ペン・丸つけの読み取り |
| 構造化 | 問題単位への分割とJSON化 |
| 分類 | 単元・小単元・難易度の判定 |
| 診断 | 正誤判定と間違え方の分類 |
| 生成 | 小2向けヒント・解き方・類題5問 |
| 計画 | 復習スケジュール(翌日/3日後/7日後 + 成績による調整) |
| 報告 | 親向け日次Slackレポート |

---

## 3. 対象ユーザーと対象範囲

### 3.1 ユーザー

- **メイン**: 小学校2年生の子ども(親子で利用)
- **サブ**: 保護者(管理・レポート閲覧)
- **将来**: 兄弟姉妹(複数プロフィールはMVPから対応)

### 3.2 教科

- **MVP**: 算数のみ
- **将来**: 国語・英語・理科・社会(`subject` カラムで拡張可能にしておく)

### 3.3 端末

スマートフォン / タブレット / PC(レスポンシブ + PWA)

---

## 4. UI方針(子ども向け)

- タッチ操作中心、大きなアイコン付きボタン
- 1画面1アクション。子どもが迷わない構成
- 漢字にはルビ(`<ruby>` タグで実装、AI出力に `rubyText` を含める)
- 音声読み上げボタン(MVPは Web Speech API の `speechSynthesis`。音声ファイルは保存しない)
- 入力は **選択・タップ・音声回答を優先**。文字入力は補助
- ほめ上手なコーチキャラクターが常駐

---

## 5. 技術構成

### 5.1 フロントエンド

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Framer Motion(演出)
- PWA対応(manifest + service worker)

### 5.2 バックエンド

- Supabase Auth(親アカウントのみ)
- Supabase Postgres(RLS必須)
- Supabase Storage(問題画像)
- Next.js Route Handlers(AI呼び出しはすべてサーバー側)
- pg_cron(画像の期限削除、日次レポート生成)

### 5.3 AI API方針

**画像生成以外はGemini API**(コスト効率重視)。**画像生成のみGPT Image系**。

| 用途 | プロバイダ | 環境変数 |
|---|---|---|
| 画像解析・OCR・手書き/赤ペン解析 | Gemini Vision | `GEMINI_VISION_MODEL` |
| 構造化出力(問題JSON・類題JSON) | Gemini | `GEMINI_STRUCTURED_MODEL` |
| ヒント・解き方・レポート文生成 | Gemini | `GEMINI_TEXT_MODEL` |
| 音声回答のテキスト化(フォールバック) | Gemini | `GEMINI_TEXT_MODEL` |
| 図解の画像生成(必要時のみ) | GPT Image | `IMAGE_GENERATION_MODEL` |

**ルール:**

- モデル名はコードに直書きしない。すべて `.env` で切り替え可能にする
- APIキーはサーバー側のみ。クライアントには一切渡さない
- AI呼び出しは `lib/ai/` のラッパー経由に統一(プロバイダ差し替え可能な設計)
- 構造化出力はGeminiの `responseSchema`(JSON Schema指定)を使い、さらに**Zodで検証**してから保存する
- 1日あたりのAI呼び出しコスト上限を設け、超過時は画像生成を停止しテンプレ画像にフォールバック

---

## 6. MVP機能一覧

### 6.1 子ども向け(必須)

| 機能 | 内容 |
|---|---|
| 今日のおすすめ問題 | 復習予定・苦手単元・正答率から自動選定 |
| 問題表示 | 1問ずつ。画像+テキスト |
| 段階式ヒント | ヒント1 → ヒント2 → 解き方 → 答え。子どもが押したときだけ表示 |
| 「ヒントを見る?」ボタン | 答えを最初に出さない |
| 「絵で教えて」ボタン | テンプレ画像優先、必要時のみ画像生成 |
| 「もっとかんたんに」ボタン | 説明をさらに平易に再生成 |
| 「もう一回やる」ボタン | 同じ問題・類題の再挑戦 |
| 類題5問 | 1問ずつ出題、4/5正解で「できた」判定 |
| 音声読み上げ | 手動再生(自動再生しない) |
| 音声回答 | Web Speech API、失敗時はタップ/数字入力に誘導 |
| ルビ | 漢字+ルビ表示 |
| コーチキャラ | ほめる・励ます定型+AI生成コメント |

### 6.2 子ども向け(MVP後)

ごほうびバッジ / 連続学習日数 / 印刷用プリント / 「ママ・パパに説明」ボタン / 学校単元表連携

### 6.3 親向け(必須)

| 機能 | 内容 |
|---|---|
| 親ログイン | Supabase Auth(email + password) |
| 子どもプロフィール | 複数対応。ニックネーム・学年のみ(本名・学校名は保存しない) |
| 問題画像アップロード | 複数ページ対応。school_print / tablet_screenshot / textbook / other |
| 学習履歴詳細 | 問題ごとの正誤・使用ヒントレベル・間違え方 |
| AI説明レベル調整 | very_easy / easy / standard |
| 利用時間制限 | 1日あたりの分数(デフォルト15分) |
| 日次Slack通知 | 学習完了後の自動送信 + 手動送信 |

### 6.4 親レポート表示順(固定)

1. 今日やった問題
2. 正答率
3. 苦手単元
4. 間違え方の傾向
5. 今週の成長
6. 次にやるべき復習
7. 学習時間
8. 連続学習日数

---

## 7. 学習体験フロー(1日)

```text
1. 子どもがホーム画面を開く(親が子どもモードに切替済み)
2. 「今日のおすすめ問題」が表示される
3. 問題を1問ずつ解く
4. 分からない → 「ヒントを見る?」→ ヒント1
5. まだ分からない → ヒント2
6. 必要なら「絵で教えて」(テンプレ画像 or 生成画像)
7. 解き方を見る → 最後に答え
8. 類題5問に挑戦(1問ずつ)
9. 4/5正解で「できた」判定、ごほうび演出
10. 結果保存 → 苦手単元マップ更新 → 復習スケジュール登録
11. 親にSlackで日次レポート送信
```

利用時間制限(`daily_limit_minutes`)に達したら、キリの良いところで「今日はここまで!」と促す(問題の途中では切らない)。

---

## 8. AI処理フロー

### 8.1 画像アップロード〜問題登録

```text
親が画像アップロード(複数ページ可)
↓
Supabase Storage に保存(materials/{user_id}/{child_id}/{material_id}/page-N.png)
↓
uploaded_materials に記録(expires_at = now + MATERIAL_RETENTION_DAYS)
↓
/api/ai/analyze-problem が Gemini Vision で解析
↓
個人情報(学校名・氏名等)を検出したら該当テキストを破棄
↓
問題ごとに分割し JSON 構造化(responseSchema + Zod検証)
↓
problems に保存(解析失敗ページは status=failed で記録し親に通知)
```

### 8.2 問題解析JSON(ParsedProblem)

```json
{
  "problemText": "1Lは何mLですか。",
  "detectedAnswer": "100mL",
  "correctAnswer": "1000mL",
  "isCorrect": false,
  "subject": "math",
  "grade": 2,
  "unit": "水のかさ",
  "subUnit": "LとmL",
  "difficulty": "standard",
  "mistakeType": "unit_conversion_error",
  "mistakeReason": "1Lを100mLと勘違いしている可能性があります。",
  "hints": {
    "hint1": "Lは大きなかさをあらわすたんいだよ。",
    "hint2": "1Lは、100mLが10こ分だよ。",
    "solution": "100mLを10こあつめると1000mLになります。だから1Lは1000mLです。",
    "answer": "1000mL"
  },
  "rubyTextRequired": true,
  "recommendedVisualTemplate": "volume",
  "similarProblemCount": 5
}
```

- `detectedAnswer` / `isCorrect` / `mistakeType` は手書き回答がある場合のみ
- `difficulty` は `"basic" | "standard" | "advanced"`
- `unit` は §11 の大分類(`lib/curriculum/grade2Math.ts`)から、`mistakeType` は §10(`lib/curriculum/mistakeTypes.ts`)からのみ選ぶ(Zod enum + DB CHECK で強制)
- `recommendedVisualTemplate` は `grade2Math.ts` の `visualTemplate` キー(例: `volume`)または `null`
- 文字数上限: `problemText` 2000 / `unit`・`subUnit` 50 / 答え 200 / ヒント・解説 1000 / `mistakeReason` 500
- すべてのAI出力はZodスキーマ(`lib/ai/schemas.ts`)で検証してから保存

---

## 9. 類題生成仕様

- 類題は**5問**、元問題と**同じ単元・同じ難易度**
- 数字を変えるだけでなく、同じ考え方を練習できる問題にする
- 子どもの `mistakeType` に応じて内容を調整(例: unit_conversion_error なら単位変換を明示的に問う)
- 1問ずつ出題、**4問以上正解で習得扱い**(weakness_map の mastery 更新)

```json
{
  "sourceProblemId": "uuid",
  "similarProblems": [
    {
      "problemText": "2Lは何mLですか。",
      "answer": "2000mL",
      "unit": "水のかさ",
      "subUnit": "LとmL",
      "difficulty": "standard",
      "explanation": "1Lは1000mLなので、2Lは1000mLが2こ分です。"
    }
  ]
}
```

---

## 10. 間違え方分類

正は `lib/curriculum/mistakeTypes.ts`(13種)。Zod(`mistakeTypeSchema`)・DB CHECK(`attempts_mistake_type_check`)・本節は必ず同じ集合にする。

```ts
type MistakeType =
  | "calculation_error"           // 計算まちがい
  | "place_value_error"           // 位のまちがい
  | "carry_error"                 // くり上がりのまちがい
  | "borrow_error"                // くり下がりのまちがい
  | "operation_choice_error"      // 式のえらびまちがい
  | "unit_conversion_error"       // 単位のまちがい
  | "reading_comprehension_error" // 問題文の読みまちがい
  | "multiplication_fact_error"   // 九九のまちがい
  | "time_error"                  // 時こくと時間のまちがい
  | "geometry_error"              // 図形のまちがい
  | "careless_error"              // 見直しで直せるまちがい
  | "unanswered"                  // 答えなし
  | "other";                      // そのほか
```

表示名マッピングは `lib/curriculum/mistakeTypes.ts` に定数として持つ(AI出力には内部値のみ使用)。AI診断の `mistakeType` は `attempts.mistake_type` まで伝搬させる。

---

## 11. 単元マップ(小2算数)

正は `lib/curriculum/grade2Math.ts`。大分類(`unit`)は以下の11単元のみ(Zod enum + DB CHECK `<table>_unit_check` で強制)。小分類(`subUnit`)は自由記述だが、原則として下記から選ぶ。

### 大分類(11単元)と小分類

| unit | subUnits | visualTemplate |
|---|---|---|
| 表とグラフ | 表の読み方 / グラフの読み方 | tables-and-graphs |
| 時こくと時間 | 時こく / 時間 / 午前と午後 | time |
| たし算 | 2けたのたし算 / くり上がり / たし算の文章題 | addition |
| ひき算 | 2けたのひき算 / くり下がり / ひき算の文章題 | subtraction |
| 長さ | cmとmm / mとcm / 長さのたし算とひき算 | length |
| 水のかさ | LとdL / LとmL / かさのたし算とひき算 | volume |
| 三角形と四角形 | 三角形 / 四角形 / 直角 / 長方形と正方形 | shapes |
| かけ算 | かけ算の意味 / 九九 / かけ算の文章題 | multiplication |
| 1000より大きい数 | 10000までの数 / 数のしくみ / 数の大小 | place-value |
| 分数 | 分けた大きさ / 2分の1 / 4分の1 | fractions |
| はこの形 | 面 / 辺 / 頂点 / はこの組み立て | boxes |

単元マスタは `lib/curriculum/grade2Math.ts` にTypeScript定数として定義し、AIの単元判定はこのリストへの分類として行う(自由記述させない)。

---

## 12. 復習スケジュール

### 12.1 基本ルール(忘却曲線ベース)

間違えた問題は **1日後 → 3日後 → 7日後** の3段階(`review_stage` 1〜3)。

### 12.2 類題結果による調整

| 類題結果 | 次の復習 |
|---|---|
| 5/5正解 | 7日後(stage繰り上げ) |
| 4/5正解 | 3日後 |
| 3/5以下 | 1日後(stage据え置き) |
| 同じ間違いが連続 | より簡単な問題(difficulty を1段下げる)に差し替え |

### 12.3 今日のおすすめ問題ロジック

優先順位つきで選定する(AI呼び出し不要。DBクエリ+ルールベース):

1. 今日が期日の復習(`review_schedule.scheduled_for <= today AND status = 'pending'`)
2. 苦手単元(`weakness_map.accuracy_rate` が低い順)の未習得問題
3. 直近の間違え方(`mistake_type`)に対応する類題
4. まだ十分に学習していない単元
5. 合計が1日15分(目安5〜7問)に収まる量

---

## 13. データ保存ポリシー

| 区分 | 対象 |
|---|---|
| **保存する** | 親アカウント / 子どもプロフィール(ニックネーム・学年) / 問題画像(期限付き) / 解析結果 / 正答率 / 間違え方 / 苦手単元 / 復習予定 / 学習履歴 / 親向けレポート |
| **保存しない** | 学校名 / 先生名 / クラス名 / 本名 / 住所 / 生成音声 / 生成した解説画像(表示後破棄) |
| **期限付き** | 問題画像: `MATERIAL_RETENTION_DAYS`(既定30日、最大90日)で自動削除(pg_cron) |

---

## 14. DB設計(Supabase Postgres)

> 完全なDDLは実装時に `supabase/migrations/` に作成する。ここではテーブルと要点のみ。
> 初期仕様からの変更点: ①`daily_limit_minutes` を `app_settings` に一本化 ②`attempts.similar_problem_id` 追加 ③`problems.status` 追加 ④`uploaded_materials.status` 追加 ⑤`slack_webhook_url` の暗号化。

### 14.1 users

`auth.users` と1:1。`id uuid PK references auth.users(id) on delete cascade`、`email`、`display_name`。
サインアップ時にDBトリガーで自動作成する。

### 14.2 child_profiles

`user_id → users`。`nickname`(本名禁止)、`grade int default 2`、`preferred_style default 'praise_coach'`、`reading_mode default 'kanji_with_ruby'`、`audio_voice default 'friendly'`。
※ `daily_limit_minutes` は持たない(`app_settings` に一本化)。

### 14.3 uploaded_materials

`child_id → child_profiles`。`file_urls text[]`(複数ページ)、`file_type`、`page_count`、`source_type`(school_print / tablet_screenshot / textbook / other)、`status`(pending / analyzing / done / failed)、`expires_at`。

### 14.4 problems

`material_id → uploaded_materials (set null)`、`child_id`。`problem_text`、`problem_image_url`、`subject default 'math'`、`grade default 2`、`unit`、`sub_unit`、`difficulty default 'standard'`、`correct_answer`、`explanation_json jsonb`(ParsedProblem全体)、`status`(active / archived)。

### 14.5 learning_sessions

`child_id`。`started_at`、`ended_at`、`duration_seconds`、`total_questions`、`correct_count`。

### 14.6 attempts

`session_id`、`child_id`、**`problem_id`(nullable)と `similar_problem_id`(nullable)のどちらか一方を必須**(CHECK制約)。
`child_answer`、`answer_type`(tap / text / voice / handwriting)、`is_correct`、`hint_level_used int`(0=未使用, 1=ヒント1, 2=ヒント2, 3=解き方, 4=答え)、`mistake_type`、`ai_feedback`。

### 14.7 generated_similar_problems

`source_problem_id → problems`、`child_id`。`problem_text`、`answer`、`explanation`、`unit`、`sub_unit`、`difficulty`。

### 14.8 weakness_map

`child_id`。`unit`、`sub_unit`、`accuracy_rate numeric`、`mistake_count`、`last_attempted_at`、`next_review_at`、`mastery_level`(learning / reviewing / mastered)。
`UNIQUE(child_id, unit, sub_unit)` で upsert 運用。

### 14.9 review_schedule

`child_id`、`problem_id`。`unit`、`sub_unit`、`scheduled_for date`、`review_stage int`(1〜3)、`status`(pending / done / skipped)。

### 14.10 parent_reports

`child_id`。`report_date date`、`summary text`、`accuracy_rate`、`weak_units jsonb`、`growth_points jsonb`、`next_recommendations jsonb`、`slack_sent_at`。
`UNIQUE(child_id, report_date)`。

### 14.11 app_settings

`child_id`(UNIQUE)。`explanation_level default 'easy'`、`daily_limit_minutes default 15`、`enable_slack default false`、`slack_webhook_url`(**Supabase Vault または pgsodium で暗号化保存**)、`enable_audio default true`、`enable_voice_answer default true`。

---

## 15. RLS方針

すべてのテーブルでRLSを有効化。基本パターン:

- `users`: `id = auth.uid()` の行のみ全操作可
- `child_profiles`: `user_id = auth.uid()` の行のみ全操作可
- その他の子テーブル: `child_id IN (SELECT id FROM child_profiles WHERE user_id = auth.uid())` の行のみ操作可
- `app_settings.slack_webhook_url`: 復号は親本人のセッションのみ。クライアントには返さない(送信処理はサーバー側で完結)
- Storage: パス `materials/{user_id}/...` の `{user_id}` が `auth.uid()` と一致する場合のみ read/write 可能なポリシー
- サービスロールキーはサーバー側のバッチ処理(pg_cron代替・解析ジョブ)のみで使用

---

## 16. API設計

すべて Next.js Route Handlers。**入力はZodで検証**し、認証チェック(セッション + child_id の所有確認)を必ず行う。AI系エンドポイントにはレート制限を入れる。

| エンドポイント | 役割 |
|---|---|
| `POST /api/materials/upload` | 画像をStorageへ保存 → `uploaded_materials` 記録 → 解析ジョブ起動 |
| `POST /api/ai/analyze-problem` | Gemini Visionで画像解析 → ParsedProblem[] → `problems` 保存 |
| `POST /api/ai/generate-hints` | ヒント再生成(「もっとかんたんに」含む)。`explanationLevel` 指定 |
| `POST /api/ai/generate-similar-problems` | 類題5問生成 → `generated_similar_problems` 保存 |
| `POST /api/ai/generate-image` | 図解画像生成(テンプレ不可時のみ。コスト上限チェック) |
| `POST /api/attempts` | 回答保存 → `weakness_map` 更新 |
| `POST /api/reviews/schedule` | 復習予定の作成・更新(類題結果による調整含む) |
| `POST /api/reports/slack` | 日次レポート生成 + Slack送信 |
| `GET /api/recommendations/today` | 今日のおすすめ問題(ルールベース選定) |

### レスポンス形式(共通)

```ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 17. Slack通知仕様

- **送信タイミング**: 1日の学習完了後(セッション終了時に自動)、または親ダッシュボードから手動
- **冪等性**: `parent_reports.slack_sent_at` で同日重複送信を防ぐ
- **失敗時**: リトライ1回。失敗してもレポート自体はダッシュボードで閲覧可能

### 通知フォーマット例

```text
【今日の学習レポート】

学習時間:15分
今日の問題:5問
正答率:4/5

よくできた単元:
・たし算の文章題

少し苦手:
・LとmLの変換

間違え方:
・単位を見落とす傾向があります

次のおすすめ:
明日は「L・mL」の復習を1問入れます。

今日のひとこと:
最後まであきらめずに考えられました。とても良い学習でした。
```

---

## 18. AIプロンプト設計

プロンプトは `lib/ai/prompts.ts` に集約する。

### 18.1 問題解析プロンプト(要点)

- 役割: 小2算数学習支援AI
- 画像から問題文・図・手書き回答・途中式・赤ペン・丸つけを読み取る
- **学校名・個人名などの個人情報は出力に含めない**
- 問題ごとに分割し、ParsedProblem の JSON Schema に従って出力
- 単元は `grade2Math.ts` の単元リストから選択させる(自由記述禁止)

### 18.2 ヒント生成プロンプト(要点)

- 役割: 小2向けの、ほめ上手な算数コーチ
- すぐに答えを出さない。hint1 → hint2 → solution → answer の順
- やさしい言葉・短い文。難しい漢字を避ける
- 間違えても否定しない。できている部分を必ずほめる(`praise` フィールド)
- 出力: `{ hint1, hint2, solution, answer, praise }`

### 18.3 類題生成プロンプト(要点)

- 役割: 小2向け算数教材作成AI
- 同じ単元・同じ難易度で5問。数字替えだけでなく同じ考え方を練習できる問題
- 子どもの間違え方(`mistakeType`)を改善できる構成
- 答えと短い解説を含めてJSONのみ出力

---

## 19. 画像生成(図解)仕様

1. **テンプレ画像優先**: 単元ごとに静的テンプレを `public/visuals/` に用意
   (L/mL変換・cm/mm変換・時計・文章題・図形・たし算・ひき算・九九)
2. **AI画像生成の条件**(すべて満たす場合のみ):
   - テンプレで説明しにくい(`recommendedVisualTemplate` が null)
   - 子どもが「絵で教えて」を押した
   - 親が画像生成を許可している
   - 当日のAPIコスト上限内
3. 生成画像は表示後破棄(Storageに保存しない)

---

## 20. セキュリティ・プライバシー

- 学校名・先生名・クラス名・本名・住所は**保存しない**(解析時に検出・除去)
- ニックネーム運用を親に案内(プロフィール作成UIで明示)
- 問題画像は期限付き保存 + 親による即時削除機能
- 全テーブルRLS / StorageもRLS
- Slack Webhook URLは暗号化保存、クライアントに返さない
- AI APIキーはサーバー側のみ
- ログに画像URL・回答全文・Webhook URLを残さない
- AI系エンドポイントにレート制限(子どもの連打・暴走対策を兼ねる)
- エラーメッセージに内部情報を含めない

---

## 21. 環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
GEMINI_TEXT_MODEL=
GEMINI_VISION_MODEL=
GEMINI_STRUCTURED_MODEL=

OPENAI_API_KEY=
IMAGE_GENERATION_MODEL=

APP_URL=
MATERIAL_RETENTION_DAYS=30
DAILY_LEARNING_LIMIT_MINUTES=15
AI_DAILY_COST_LIMIT_USD=2
```

※ `SLACK_WEBHOOK_URL` は環境変数ではなく `app_settings` に親ごとに暗号化保存(マルチ家庭対応のため)。

---

## 22. ディレクトリ構成

```text
app/
  page.tsx                  # ランディング → ログイン or 子どもホームへ
  login/
  child/
    home/                   # 子どもホーム
    problem/[id]/           # 問題・ヒント・類題
    result/                 # 結果画面
  parent/
    dashboard/
    upload/
    settings/
  api/
    materials/upload/
    ai/analyze-problem/
    ai/generate-hints/
    ai/generate-similar-problems/
    ai/generate-image/
    attempts/
    reviews/schedule/
    reports/slack/
    recommendations/today/

components/
  child/                    # CharacterCoach, BigIconButton, ProblemCard,
                            # HintStepper, VoiceButton, SimilarProblemCard, RubyText
  parent/                   # ParentDashboard, UploadMaterials, WeaknessMap, ReportCard

lib/
  supabase/                 # client.ts, server.ts, middleware.ts
  ai/                       # gemini.ts, image.ts, schemas.ts, prompts.ts, costGuard.ts
  slack/                    # sendReport.ts
  curriculum/               # grade2Math.ts, mistakeTypes.ts
  review/                   # schedule.ts(復習ロジック), recommend.ts(おすすめ選定)
  utils/                    # ruby.ts ほか

types/                      # problem.ts, child.ts, report.ts, ai.ts
supabase/
  migrations/               # DDL + RLS
public/visuals/             # テンプレ図解画像
```

---

## 23. 受け入れ条件(v0.1)

### 子ども画面

- [x] 子どもが1人で「今日のおすすめ問題」を始められる
- [x] 問題が1問ずつ出る
- [x] ヒントは押したときだけ出る。答えが最初に表示されない
- [x] 類題が5問出て、4/5で「できた」と表示される
- [x] 音声読み上げボタンがある
- [x] 漢字にルビが付く(`RubyAuto`/`toRubyParts` + `rubyDictionary` で問題文・ヒントに適用。`reading_mode=hiragana` のときは読みに置換)

### 親画面

- [x] ログイン・子どもプロフィール作成(複数)ができる
- [x] 問題画像を複数ページアップロードできる
- [x] 今日の学習履歴・正答率・苦手単元が見られる
- [x] Slack通知が届く(同日重複なし)

### AI

- [x] Geminiで問題画像を解析しZod検証済みJSONで保存できる
- [x] 単元判定・間違え方分類ができる
- [x] 類題5問を生成できる(`generate-similar-problems` が mock/gemini 分岐。gemini 時は `buildSimilarProblemsPrompt` + `generateStructured` で Zod検証つき個別生成、コストガード・usage記録あり)
- [x] 画像生成は条件を満たすときのみ実行される(`lib/ai/costGuard.ts` で判定)

### 非機能

- [x] 全テーブル・StorageにRLSが効いている(他家庭のデータが見えない)
- [x] APIキーがクライアントバンドルに含まれない
- [x] 主要ロジック(復習スケジュール・おすすめ選定・Zodスキーマ)にユニットテストがある

---

## 24. v0.1 最小構成(最初の完成ライン)

親ログイン → 子どもプロフィール → 画像アップロード → Gemini解析 → 問題保存 → 子どもホーム → 今日のおすすめ問題 → ヒント表示 → 類題5問 → 正誤保存 → 苦手単元保存 → 復習予定保存 → Slack通知

この状態で家庭内で実際に使える最初のバージョンとなる。

---

## 付録A: 初期仕様からの変更点

| # | 変更 | 理由 |
|---|---|---|
| 1 | `daily_limit_minutes` を `app_settings` に一本化(`child_profiles` から削除) | 同じ設定が2テーブルにあり不整合の温床 |
| 2 | `attempts` に `similar_problem_id` を追加(problem_id とどちらか一方必須) | 類題への回答を記録するテーブルが無かった |
| 3 | 復習ルールを「1日後/3日後/7日後」に統一 | 「翌日」と「1日後」の表記ゆれ |
| 4 | `slack_webhook_url` を暗号化保存、環境変数から削除 | 平文保存はリスク。家庭ごとに異なるURLになるため env では持てない |
| 5 | 子どもの認証を「親セッション内のUIモード」と明記 | 初期仕様で未定義 |
| 6 | `uploaded_materials.status` / `problems.status` 追加 | 解析の非同期処理と失敗時のリカバリに必要 |
| 7 | `uploaded_materials.file_url` → `file_urls text[]` | 複数ページ対応の仕様と単数カラムが矛盾 |
| 8 | 画像期限削除・日次レポートの実行主体を pg_cron と明記 | 初期仕様で未定義 |
| 9 | 単元判定を `grade2Math.ts` の定数リストへの分類に限定 | AI自由記述だと weakness_map の集計が壊れる |
| 10 | AI出力のZod検証、AIコスト上限(`AI_DAILY_COST_LIMIT_USD`)を追加 | 信頼性とコスト暴走防止 |
| 11 | 音声読み上げ/音声回答は Web Speech API を第一選択と明記 | コストゼロ・保存不要でポリシーと整合 |
| 12 | `weakness_map` に `UNIQUE(child_id, unit, sub_unit)`、`parent_reports` に `UNIQUE(child_id, report_date)` | upsert と冪等な日次レポートに必要 |
