"use client";

import type { AccessoryCategory, EquippedAccessories } from "./catalog";
import { normalizeEquipped, normalizeRewardState, type RewardState } from "./rewardLogic";
import { getRewardState, saveRewardState } from "./rewardStore";
import { getEquippedAccessories, saveEquippedAccessories } from "./characterGrowthStore";

/**
 * 端末キャッシュと DB(child_rewards)の同期。
 * - 子ども画面を開いたら、その子のごほうび・着せかえを DB から読んで表示を合わせる
 * - 以前の版で端末だけに貯まっていたごほうびは、最初の1回だけその子へ取り込む
 */

const ACTIVE_CHILD_KEY = "kanoha_active_child_v1";
/** 旧データの取り込みは端末ごとに1回だけ(きょうだいに二重で入らないように) */
const LEGACY_IMPORTED_KEY = "kanoha_rewards_legacy_imported_v1";
const UUID = /^[0-9a-f-]{36}$/i;

interface ServerRewards {
  reward: RewardState;
  equipped: EquippedAccessories;
  stored: boolean;
}

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても続ける
  }
};

const parseServerRewards = (data: unknown): ServerRewards | null => {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  return {
    reward: normalizeRewardState(value.reward as Partial<Record<keyof RewardState, unknown>>),
    equipped: normalizeEquipped(value.equipped),
    stored: value.stored === true,
  };
};

async function requestRewards(childId: string, init?: RequestInit): Promise<ServerRewards | null> {
  const response = await fetch(`/api/children/${childId}/rewards`, init).catch(() => null);
  const json = await response?.json().catch(() => null);
  if (!response?.ok || !json?.success) return null;
  return parseServerRewards(json.data);
}

const sendJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function getActiveChildId(): string | null {
  const id = readStorage(ACTIVE_CHILD_KEY);
  return id && UUID.test(id) ? id : null;
}

async function importLegacyIfNeeded(childId: string, loaded: ServerRewards): Promise<ServerRewards> {
  if (readStorage(LEGACY_IMPORTED_KEY)) return loaded;
  const legacy = getRewardState();
  const hasLegacy = legacy.totalCorrectCount > 0;
  const imported =
    !loaded.stored && hasLegacy
      ? await requestRewards(childId, sendJson("POST", { reward: legacy, equipped: getEquippedAccessories() }))
      : loaded;
  if (!imported) return loaded; // 失敗したら次に開いたときにもう一度
  writeStorage(LEGACY_IMPORTED_KEY, new Date().toISOString());
  return imported;
}

/** 子ども画面を開いたときに呼ぶ。失敗したら端末の表示のまま続ける。 */
export async function syncRewardsFromServer(childId: string): Promise<boolean> {
  if (!UUID.test(childId)) return false;
  // 着せかえの保存先はいま開いている子ども(読み込みに失敗しても、ほかの子に書かないように先に切り替える)
  writeStorage(ACTIVE_CHILD_KEY, childId);
  const loaded = await requestRewards(childId);
  if (!loaded) return false;
  const current = await importLegacyIfNeeded(childId, loaded);
  saveRewardState(current.reward);
  saveEquippedAccessories(current.equipped);
  return true;
}

/** 着せかえを DB にも保存する(表示は先に変えておく)。 */
export async function saveEquipToServer(category: AccessoryCategory, itemId: string): Promise<boolean> {
  const childId = getActiveChildId();
  if (!childId) return false;
  const saved = await requestRewards(childId, sendJson("PATCH", { category, itemId }));
  return Boolean(saved);
}
