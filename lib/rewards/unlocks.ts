import { GROWTH_LEVELS, type AccessoryItem } from "./catalog";

/** そのレベルになるまで、あと何もん(正解)か。すでに届いていれば 0。レベルは 1〜10 に丸める。 */
export function remainingCorrectForLevel(level: number, totalCorrect: number): number {
  const index = Math.min(GROWTH_LEVELS.length, Math.max(1, Number.isFinite(level) ? Math.round(level) : 1)) - 1;
  return Math.max(0, GROWTH_LEVELS[index].minCorrect - Math.max(0, Number.isFinite(totalCorrect) ? totalCorrect : 0));
}

/** アイテムが かいほうされるまで、あと何もんか。 */
export const remainingCorrectForItem = (item: AccessoryItem, totalCorrect: number): number =>
  remainingCorrectForLevel(item.unlockLevel, totalCorrect);
