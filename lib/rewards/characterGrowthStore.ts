"use client";

import { getRewardState } from "./rewardStore";
import {
  DEFAULT_EQUIPPED,
  GROWTH_LEVELS,
  getCharacterLevel,
  type AccessoryCategory,
  type EquippedAccessories,
  type GrowthLevelInfo,
} from "./catalog";
import { CATEGORIES, normalizeEquipped } from "./rewardLogic";

export {
  ACCESSORY_CATALOG,
  DEFAULT_EQUIPPED,
  GROWTH_LEVELS,
  getCharacterLevel,
  isAccessoryUnlocked,
  type AccessoryCategory,
  type AccessoryItem,
  type EquippedAccessories,
  type GrowthLevelInfo,
} from "./catalog";

const ACCESSORY_STORAGE_KEY = "kanoha_child_equipped_accessories_v1";
const ACCESSORY_FOCUS_KEY = "kanoha_child_accessory_focus_v1";

export interface CharacterProgress {
  currentLevel: GrowthLevelInfo;
  nextLevel: GrowthLevelInfo | null;
  totalCorrect: number;
  currentLevelCorrect: number;
  neededForNextLevel: number;
  progressPercent: number; // 0 - 100
}

export function getCharacterProgress(): CharacterProgress {
  const { totalCorrectCount } = getRewardState();
  const currentLevel = getCharacterLevel(totalCorrectCount);
  const nextLevel =
    currentLevel.level < GROWTH_LEVELS.length
      ? GROWTH_LEVELS[currentLevel.level] // 次のindex
      : null;

  const currentLevelCorrect = totalCorrectCount - currentLevel.minCorrect;
  let neededForNextLevel = 0;
  let progressPercent = 100;

  if (nextLevel && Number.isFinite(currentLevel.maxCorrect)) {
    const range = currentLevel.maxCorrect - currentLevel.minCorrect;
    neededForNextLevel = Math.max(0, currentLevel.maxCorrect - totalCorrectCount);
    progressPercent = Math.min(100, Math.max(0, Math.round((currentLevelCorrect / range) * 100)));
  }

  return {
    currentLevel,
    nextLevel,
    totalCorrect: totalCorrectCount,
    currentLevelCorrect,
    neededForNextLevel,
    progressPercent,
  };
}

export function getEquippedAccessories(): EquippedAccessories {
  if (typeof window === "undefined") return { ...DEFAULT_EQUIPPED };
  try {
    const raw = localStorage.getItem(ACCESSORY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EQUIPPED };
    const parsed = JSON.parse(raw) as unknown;
    return normalizeEquipped(parsed);
  } catch {
    return { ...DEFAULT_EQUIPPED };
  }
}

export function saveEquippedAccessories(accessories: EquippedAccessories): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCESSORY_STORAGE_KEY, JSON.stringify(accessories));
    window.dispatchEvent(
      new CustomEvent("kanoha-accessory-update", { detail: accessories })
    );
  } catch {
    // ignore
  }
}

export function getLastEquippedCategory(): AccessoryCategory {
  if (typeof window === "undefined") return "clothes";
  try {
    const category = localStorage.getItem(ACCESSORY_FOCUS_KEY);
    if (category && (CATEGORIES as readonly string[]).includes(category)) {
      return category as AccessoryCategory;
    }
  } catch {
    // ignore
  }
  return "clothes";
}

export function equipAccessory(
  category: AccessoryCategory,
  itemId: string
): EquippedAccessories {
  const current = getEquippedAccessories();
  const updated: EquippedAccessories = {
    ...current,
    [category]: itemId,
  };
  try {
    localStorage.setItem(ACCESSORY_FOCUS_KEY, category);
  } catch {
    // ignore
  }
  saveEquippedAccessories(updated);
  return updated;
}
