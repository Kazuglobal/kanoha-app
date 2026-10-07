/**
 * 英会話れんしゅうの声かけ(否定しない・はげます)。
 * 声で読むものは「おしい」「だいじょうぶ」を含める(preloadCoachVoices が think の声として先読みする)。
 */

/** まちがえた直後: はげましてから、正しい言い方を聞かせる */
export const TALK_ENCOURAGE = [
  "おしい！ こう いうと つたわるよ。",
  "だいじょうぶ！ いっしょに いってみよう。",
  "おしい！ もうすこしだよ。きいてね。",
] as const;

/** まねが聞き取れなかったとき(画面の文言) */
export const TALK_REPEAT_RETRY = [
  "おしい！ もう いちど、ゆっくり いってみよう",
  "だいじょうぶ！ おてほんを きいて、まねしてね",
  "いいね、あと すこし！ もう いちど いってみよう",
] as const;

/** まねできたあと、おなじ質問をもう1回きくとき */
export const TALK_ASK_AGAIN = "じょうず！ もういちど きくね。こんどは じぶんで こたえてみよう";

/** 聞きなおしで言えたとき */
export const TALK_RETRY_SUCCESS = "できた！ ちゃんと いえたね！";

/** n 回目のまちがいに合わせて、はげましの言葉を順番に選ぶ(同じ言葉が続かない)。 */
export const pickPhrase = <T extends string>(phrases: readonly T[], count: number): T =>
  phrases[((count % phrases.length) + phrases.length) % phrases.length];
