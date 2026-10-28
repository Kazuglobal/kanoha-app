# 実装メモ: 英語でおはなし改善 / 新問題の自動生成 / 着せかえ拡張と動き

計画の正本: `C:\Users\s1598\.claude\plans\blender-mcp-hidden-stallman.md`(承認済み)
ブランチ: `feat/adaptive-practice-dressup`(`fix/audit-2026-10` から作成)。フェーズごとにコミットする。

## 進み具合

| フェーズ | 状態 | コミット |
|---|---|---|
| P0 緊急修正(一覧クラッシュ・答えもれ) | 完了 | `2ccc3f0` `46428f6` `04117fb` |
| Phase 1 英会話の修正 | 未着手 | |
| Phase 2a 進捗エンジン+生成器 | 未着手 | |
| Phase 2b 保存・API・UI(migration 0006) | 未着手 | |
| Phase 3 英会話の拡張(migration 0007) | 未着手 | |
| Phase 4 着せかえの土台(migration 0008) | 未着手 | |
| Phase 5 モーション | 未着手 | |
| Phase 6 新パーツ・アセット | 未着手 | |
| Phase 2c AI生成(既定OFF) | 未着手 | |

## 前提(ユーザーが決めたこと)

- キャラは2Dのまま動きを足す(3D化しない)。
- 次の問いは「つぎへ ▶」をタップしたときだけ読む(ほめ・おしえは自動のまま)。
- 5円メーターの1日上限: 英会話 5回 / 新問題 10回(`TALK_DAILY_REWARD_CAP` / `GENERATED_DAILY_REWARD_CAP`)。
- マイク: ログイン中は自動、デモはタップ式。
- 読解・作文のAI生成は実装するが既定OFF。名前を聞くターンは「なりきり」形式。

## Deviations(計画からのずれ)

- **P0: Playwright の接続先を `127.0.0.1` → `localhost` に変更**(`playwright.config.ts`, `e2e/child-mode.spec.ts`)。
  計画外だが、検証ゲートの `real-loop.spec.ts` が元から落ちていた。原因は、本番モード(`next start`)の子どもモード cookie が
  Secure で、Playwright 1.62 は Secure cookie を https と `localhost` にしか送らない(`127.0.0.1` には送らない)こと。
  サーバー側の動きは curl で 302 を確認済み。`E2E_ORIGIN` で上書きでき、サーバーのポートも追従する。
- **P0: 境界テストを計画より強くした**(反証レビューの指摘)。`tests/security/boundaryScan.ts` が、サーバー側全体の探索・
  default/再エクスポート・`server-only` の付け忘れ・共通モジュール経由の答えへの到達を検査する(自己テスト付き)。
- **P0: `check:leaks` を `npm run deploy` に組み込んだ**(CI が `npm run deploy` を呼ぶので、デプロイ前に必ず走る)。
  ビルドがソースより古い・JS が1つもない場合は、OK にせず終了コード 2。
- **P0: `app/child/error.tsx` に `ChildHeader`(親のPINボタン)を入れた**。ホーム自体が壊れても子どもモードに閉じ込めないため。

## 見つけた落とし穴(gotchas。完了時に kanoha-gotchas メモリへ)

- サーバーコンポーネントから `"use client"` ファイルの関数・定数を呼ぶと、リクエスト時に「サーバーから呼べない」で落ちる。
  Vitest はこの境界を再現しないので、`tests/security/clientBoundary.test.ts` が静的に見張る。
- 答えを持つモジュールには `import "server-only"`(Next 内蔵で動く。パッケージ追加は不要。Vitest だけ alias が要る)。
- `check:leaks` は新しいビルドが前提。ソースを直したら `npm run build` をやり直す。
- Playwright の `page.request` は Secure cookie を `127.0.0.1` に送らない。e2e は `localhost` で呼ぶ。
