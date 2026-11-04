import type { CheckFailure } from "@/lib/englishTalk/checkClient";

/** えいごで おはなしで子どもに見せる言葉(ひらがな中心。まちがえても励ます)。 */

export const TALK_PRAISE = ["Great job!", "Good!", "Nice!", "Perfect!", "Wonderful!"] as const;

export const TALK_MESSAGES = {
  praise: "ばっちり つたわったよ！",
  repeatDone: "Great! じょうず！",
  japaneseHelp: "にほんごに したよ！ きいてから えいごで はなしてみよう",
  needsEnglish: "にほんごだね！ えいごでは なんて いうかな？ ヒントも つかえるよ",
  unclear: "うまく ききとれなかったよ。もういちど いってみてね",
} as const;

export const TALK_FAILURE_MESSAGES: Readonly<Record<CheckFailure, string>> = {
  rate_limited: "ちょっと やすもう。すこし したら また はなそう",
  offline: "つながらなかったよ。もういちど おしてみてね",
  server: "うまく いかなかったよ。もういちど おしてみてね",
};
