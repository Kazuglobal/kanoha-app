# 実装メモ: 英語でおはなし改善 / 新問題の自動生成 / 着せかえ拡張と動き

計画の正本: `C:\Users\s1598\.claude\plans\blender-mcp-hidden-stallman.md`(承認済み)
ブランチ: `feat/adaptive-practice-dressup`(`fix/audit-2026-10` から作成)。フェーズごとにコミットする。

## 進み具合

| フェーズ | 状態 | コミット |
|---|---|---|
| P0 緊急修正(一覧クラッシュ・答えもれ) | 完了 | `2ccc3f0` `46428f6` `04117fb` |
| Phase 1 英会話の修正 | 完了(単体 1067 件・`next build`・OpenNext バンドル・`check:leaks`・e2e 36 件・型・lint すべて緑。反証レビュー2回) | `4d9f449` |
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

- **Phase 1: 自由入力欄を撤去したので、答えの送り方を変えた**。テストは Web Speech の疑似入力(`say()`)か 4択で答えを送る。
- **Phase 1: マイクが使えないとわかったとき、マイク部品は消さず 4択を自動で出す**(計画は「自動で4択」だけ。部品を消すと
  「サーバーが一時的に受け付けない」状態を忘れ、子どもがもう一度タップして試すこともできなくなるため)。まねして言うでは「いえたよ！」も出す。
- **Phase 1: 聞き取り(STT)のプロンプトは「質問だけ」を渡す**(計画は質問+4択。4択も渡すと書き起こしが選択肢に寄るため)。
- **Phase 1: 「やり直し」の回を表す番号(`runRef`)を足した**。待っているあいだに「もういちど」を押すと、古い答え合わせの結果が
  新しい場面に紛れ込み、判定中のフラグも残って答えられなくなる不具合を、フックのテストで再現して直した。
- **Phase 1: 子ども向けの文言のルビは使わず、ひらがなにした**(計画は `TALK_TEXT` + `RubyAuto`)。ルビ基盤を広げずに済み、
  `tests/components/englishTalkKidText.test.ts` が、画面のコードに漢字が残らないことを見張る。
- **Phase 1: `three` の遅延読み込み(`next/dynamic`)は見送り**。サイズの問題を測っていないため。代わりに実害のある
  メモリの解放(プロップの dispose・`forceContextLoss`)、タブが隠れたら描画を止める、「動きを減らす」の設定の追従、
  WebGL が無いとき場面のSVGを背景に出す、を直した。
- **Phase 1: 英会話のセッション連携(1日の上限)は見送り**。問題0件のセッションが親レポートの学習時間を歪めうるため。
  `daily_limit_minutes` を英会話が無視する点は既知の制限として残す(計画の「削る順」の⑦)。
- **Phase 1: `RealtimeTalkMic.tsx` は 821行 → 775行**。型・定数・文末判定を `micSpeech.ts` に切り出した(800行以下の決まりを満たす)。

### Phase 1 の反証レビューで直したもの(確認ずみの指摘)

- まねして言うの行き止まり: 数字・縮めた言い方・複数形・2語の別名をそろえて比べる(`canonicalize` / `stem`)。2回合わなければ「いえたよ！」でも進める。
- 「7歳」「3こ」が英語の答えとして正解になっていた(数字を英語の文字と数えていた)→ 日本語がまざる答えは英語として数えない(`mixed` / `japanese`)。
- 名前の判定を `matchesName` に一本化(「My name's Yuki」を通す。名前のない「My name is」・「Your name is …」は通さない)。
- カタカナの短い語は、一続きがその語だけのときだけ英語にする(ワンちゃん・ノート・テントを英語にしない)。全角の英字(NFKC)・書き起こしの印は無視。聞き取れなかった(`unclear`)は、まちがいにしない。
- 別名の判定で、お手本の答えと問いの言葉も許す(「Good warning」「Tree apples」)。`reject`(how-are-you に Good morning など)。受け入れる言い方・どうぶつ・くだものを増やした。
- 4択しか使えないとき(親の設定でオフ・マイクが使えない)は、4択で答えてもヘルプにしない。4択を開いたらヘルプ。
- 画面を離れたあとに届いた答え合わせでは音も読み上げも出さない。最後のターンは「つぎへ」を押さなくても ★ を記録し、ボタンは「おわる ▶」。
- 答えのあと(日本語だけ・聞き取れなかった・通信の失敗・まねして言う)にマイクを入れなおす(`micKey`)。「いえたよ！」の連打は1回ぶん。通信は10秒で時間切れ。
- 聞き取りの候補から「わからない」を選ぶのは、はっきりした言い方のときだけ(`isExplicitDontKnow`)。聞き取り(STT)のプロンプトに「訳さない」を追加。
- e2e: 通信(先読み)ではなく、実際に音を鳴らす呼び出しを数える。

### Phase 1 で直さず残したもの(理由つき)

- 関数の長さ(50行以下の決まり): `useEnglishTalk` 約330行・`EnglishTalkStage` 約190行・3Dの描画の effect 約240行。もとの実装も同じ規模で、
  分けるには状態機械の作り直しが要り、回帰の危険のほうが大きい。後のフェーズで着手する場合は、ターンの処理を hook に分ける。
- AI 判定の `feedback`(最大200字)は、ひらがなを求めるだけで漢字を検査していない。aiJudge のターンは2つで、ログイン中の子だけ。
- 効果音(`soundManager`)は `enable_audio` を見ない(アプリ全体の既定どおり)。読み上げ(TTS)は見る。
- 「I have two dogs」(年齢の質問)のように、キーワードを含む文は受け入れる(「キーワードを含めば正解」という既存の方針のまま)。
- ローマ字の日本語(arigato など)は日本語と見分けない。

## 見つけた落とし穴(gotchas。完了時に kanoha-gotchas メモリへ)

- サーバーコンポーネントから `"use client"` ファイルの関数・定数を呼ぶと、リクエスト時に「サーバーから呼べない」で落ちる。
  Vitest はこの境界を再現しないので、`tests/security/clientBoundary.test.ts` が静的に見張る。
- 答えを持つモジュールには `import "server-only"`(Next 内蔵で動く。パッケージ追加は不要。Vitest だけ alias が要る)。
- `check:leaks` は新しいビルドが前提。ソースを直したら `npm run build` をやり直す。
- Playwright の `page.request` は Secure cookie を `127.0.0.1` に送らない。e2e は `localhost` で呼ぶ。
- メモリが少ない PC(空き 2GB 未満)では、ビルドを軽くして1つずつ流す。`CIRCLE_NODE_TOTAL=2 NODE_OPTIONS=--max-old-space-size=2560 npx next build`
  → `npx opennextjs-cloudflare build --skipNextBuild`(二重に `next build` を走らせない)→ `npm run check:leaks`。
  e2e は `node node_modules/next/dist/bin/next start -p 3107` を自分で起動し(Playwright は `reuseExistingServer` で使い回す。
  `webServer.command` の `npm run build` を走らせない)、`npx playwright test --workers=2`。終わったらその PID だけ止める。
- 同じ理由で Vitest の全体実行が 600 秒かかり、`tests/api/learning-loop.test.ts` の最初のテスト(`await import` が重い)が
  15 秒で落ちた。単独では 5.6 秒。`npx vitest run --maxWorkers=3` なら 293 秒で全件通る。タイムアウトを延ばして隠さない。
- バックグラウンドで `cmd > log; echo "exit=$?" >> log` と流すと、通知の終了コードは最後の `echo` のもの(常に 0)。
  ログの `exit=` 行を読んで判断する。
