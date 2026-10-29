import { envNumber } from "./envNumber";

/**
 * 機能の上限・切り替え(環境変数)。Workers では環境変数がリクエスト時にしか確定しないので、
 * 定数にせず、呼び出すたびに読む関数にしている。
 */

export const DEFAULT_TALK_DAILY_REWARD_CAP = 5;
export const DEFAULT_GENERATED_DAILY_REWARD_CAP = 10;
export const DEFAULT_PRACTICE_MAX_SETS_PER_DAY = 3;

/** 英会話の正解を 5円メーターに数える、1日(JST)あたりの回数の上限。 */
export const talkDailyRewardCap = (): number =>
  Math.floor(envNumber("TALK_DAILY_REWARD_CAP", DEFAULT_TALK_DAILY_REWARD_CAP));

/** 自動で作った「あたらしい もんだい」の正解を 5円メーターに数える、1日(JST)あたりの回数の上限。 */
export const generatedDailyRewardCap = (): number =>
  Math.floor(envNumber("GENERATED_DAILY_REWARD_CAP", DEFAULT_GENERATED_DAILY_REWARD_CAP));

/** 1日(JST)に、1つの教科で作れる「あたらしい もんだい」のセットの数。0 なら作らない。 */
export const practiceMaxSetsPerDay = (): number =>
  Math.floor(envNumber("PRACTICE_MAX_SETS_PER_DAY", DEFAULT_PRACTICE_MAX_SETS_PER_DAY));

const OFF_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

/**
 * 「あたらしい もんだい」の自動生成を使うか(FEATURE_PRACTICE_GENERATION)。未設定なら使う。
 * テンプレートで作るので費用はかからない。止めたいときだけ 0 / false / off を入れる。
 */
export const practiceGenerationEnabled = (): boolean => {
  const raw = process.env.FEATURE_PRACTICE_GENERATION?.trim().toLowerCase();
  return raw === undefined || raw === "" || !OFF_VALUES.has(raw);
};
