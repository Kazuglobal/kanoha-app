/**
 * 1 つの場面の ★(1〜3)の計算。クライアント(終了画面)とサーバー(進みぐあいの記録)で同じ式を使う。
 * - clean: ヘルプなしで 1 回で言えた
 * - help : 日本語のヒントか 4 択を使って、1 回で言えた
 * - teach: まちがえて、おてほんを見てまねした
 */

export type TalkOutcome = "clean" | "help" | "teach";

const POINTS: Readonly<Record<TalkOutcome, number>> = { clean: 2, help: 1, teach: 0 };

/** この点数の割合以上で ★3(おてほんを見たターンがないとき) */
const THREE_STAR_RATIO = 0.75;
/** この点数の割合以上で ★2 */
const TWO_STAR_RATIO = 0.4;

export function talkStars(outcomes: readonly TalkOutcome[]): 1 | 2 | 3 {
  if (outcomes.length === 0) return 1;
  const points = outcomes.reduce((sum, outcome) => sum + POINTS[outcome], 0);
  const ratio = points / (outcomes.length * POINTS.clean);
  if (ratio >= THREE_STAR_RATIO && !outcomes.includes("teach")) return 3;
  return ratio >= TWO_STAR_RATIO ? 2 : 1;
}
