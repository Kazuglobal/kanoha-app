import {
  ACCESSORY_CATALOG,
  DEFAULT_EQUIPPED,
  getCharacterLevel,
  isAccessoryUnlocked,
  type AccessoryCategory,
  type EquippedAccessories,
  type GrowthLevelInfo,
} from "./catalog";

/**
 * ごほうびの計算(クライアント・サーバー共通の純粋関数)。
 * 10問正解ごとに5円。正解数でキャラクターのレベルが上がる。
 */

export const REWARD_CYCLE = 10;
export const YEN_PER_CYCLE = 5;

export interface RewardState {
  currentCycleCount: number; // 0 - 9 (10問で1サイクル)
  totalCorrectCount: number;
  totalRewardYen: number; // 累計獲得金額(円)
  lastRewardEarnedAt?: string;
}

export const DEFAULT_REWARD_STATE: RewardState = {
  currentCycleCount: 0,
  totalCorrectCount: 0,
  totalRewardYen: 0,
};

export interface RewardChange {
  previousState: RewardState;
  newState: RewardState;
  earnedFiveYen: boolean;
  newCycleCount: number; // 5円をもらった瞬間は 10 として表示する
  leveledUp: boolean;
  previousLevel: GrowthLevelInfo;
  newLevel: GrowthLevelInfo;
}

const nonNegativeInt = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
};

/** 保存値・API 応答をそのまま信じず、範囲内の RewardState に整える。 */
export function normalizeRewardState(raw: Partial<Record<keyof RewardState, unknown>> | null | undefined): RewardState {
  if (!raw) return DEFAULT_REWARD_STATE;
  const last = raw.lastRewardEarnedAt;
  return {
    currentCycleCount: nonNegativeInt(raw.currentCycleCount) % REWARD_CYCLE,
    totalCorrectCount: nonNegativeInt(raw.totalCorrectCount),
    totalRewardYen: nonNegativeInt(raw.totalRewardYen),
    ...(typeof last === "string" && last ? { lastRewardEarnedAt: last } : {}),
  };
}

/** 1問正解したあとの状態。 */
export function applyCorrectAnswer(current: RewardState, nowIso: string): RewardState {
  const nextCycle = current.currentCycleCount + 1;
  const earned = nextCycle >= REWARD_CYCLE;
  return {
    currentCycleCount: earned ? 0 : nextCycle,
    totalCorrectCount: current.totalCorrectCount + 1,
    totalRewardYen: earned ? current.totalRewardYen + YEN_PER_CYCLE : current.totalRewardYen,
    ...(earned
      ? { lastRewardEarnedAt: nowIso }
      : current.lastRewardEarnedAt
        ? { lastRewardEarnedAt: current.lastRewardEarnedAt }
        : {}),
  };
}

/** 1問正解した「あと」の状態から、正解する「まえ」の状態を戻す(サーバー応答からイベントを作るため)。 */
export function previousOfCorrectAnswer(next: RewardState): RewardState {
  const earned = next.currentCycleCount === 0 && next.totalCorrectCount > 0;
  return {
    currentCycleCount: earned ? REWARD_CYCLE - 1 : Math.max(0, next.currentCycleCount - 1),
    totalCorrectCount: Math.max(0, next.totalCorrectCount - 1),
    totalRewardYen: earned ? Math.max(0, next.totalRewardYen - YEN_PER_CYCLE) : next.totalRewardYen,
    ...(next.lastRewardEarnedAt && !earned ? { lastRewardEarnedAt: next.lastRewardEarnedAt } : {}),
  };
}

export function describeRewardChange(previousState: RewardState, newState: RewardState): RewardChange {
  const earnedFiveYen = newState.totalRewardYen > previousState.totalRewardYen;
  const previousLevel = getCharacterLevel(previousState.totalCorrectCount);
  const newLevel = getCharacterLevel(newState.totalCorrectCount);
  return {
    previousState,
    newState,
    earnedFiveYen,
    newCycleCount: earnedFiveYen ? REWARD_CYCLE : newState.currentCycleCount,
    leveledUp: newLevel.level > previousLevel.level,
    previousLevel,
    newLevel,
  };
}

export const CATEGORIES: readonly AccessoryCategory[] = [
  "character",
  "clothes",
  "hairstyle",
  "hair_color",
  "shoes",
  "shoes_color",
  "hat",
  "glasses",
  "gloves",
  "accessory",
];

const itemInCategory = (category: AccessoryCategory, itemId: unknown): itemId is string =>
  typeof itemId === "string" && ACCESSORY_CATALOG.some((item) => item.id === itemId && item.category === category);

/** カタログに無いアイテムは既定に戻す。 */
export function normalizeEquipped(raw: unknown): EquippedAccessories {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return CATEGORIES.reduce<EquippedAccessories>(
    (acc, category) => ({
      ...acc,
      [category]: itemInCategory(category, source[category]) ? source[category] : DEFAULT_EQUIPPED[category],
    }),
    DEFAULT_EQUIPPED,
  );
}

export function parseEquippedJson(json: string | null | undefined): EquippedAccessories {
  if (!json) return DEFAULT_EQUIPPED;
  try {
    return normalizeEquipped(JSON.parse(json));
  } catch {
    return DEFAULT_EQUIPPED;
  }
}

/** そのカテゴリのアイテムで、いまのレベルで解放ずみなら true。 */
export function canEquip(category: AccessoryCategory, itemId: string, totalCorrect: number): boolean {
  const item = ACCESSORY_CATALOG.find((entry) => entry.id === itemId && entry.category === category);
  return Boolean(item && isAccessoryUnlocked(item, totalCorrect));
}
