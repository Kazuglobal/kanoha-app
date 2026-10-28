import { envNumber } from "./envNumber";

/**
 * 機能の上限・切り替え(環境変数)。Workers では環境変数がリクエスト時にしか確定しないので、
 * 定数にせず、呼び出すたびに読む関数にしている。
 */

export const DEFAULT_TALK_DAILY_REWARD_CAP = 5;

/** 英会話の正解を 5円メーターに数える、1日(JST)あたりの回数の上限。 */
export const talkDailyRewardCap = (): number =>
  Math.floor(envNumber("TALK_DAILY_REWARD_CAP", DEFAULT_TALK_DAILY_REWARD_CAP));
