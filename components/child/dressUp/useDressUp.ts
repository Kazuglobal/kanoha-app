"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccessoryCategory } from "@/lib/rewards/catalog";
import {
  getCharacterProgress,
  getEquippedAccessories,
  saveEquippedAccessories,
  type CharacterProgress,
  type EquippedAccessories,
} from "@/lib/rewards/characterGrowthStore";
import { diffEquipped, equipAfterTap, resetToDefaults } from "@/lib/rewards/dressUp";
import { applyOutfit, type OutfitPreset } from "@/lib/rewards/outfits";
import { flushEquippedSave, queueEquippedSave } from "@/lib/rewards/rewardSync";

export interface DressUp {
  equipped: EquippedAccessories;
  progress: CharacterProgress;
  /** サーバーに保存できなかった(保存待ちに残してあり、あとで送り直す) */
  saveFailed: boolean;
  tap: (slot: AccessoryCategory, itemId: string) => void;
  wear: (preset: OutfitPreset) => void;
  reset: () => void;
  /** 待っている保存をすぐ送る(画面を閉じるとき) */
  finish: () => void;
}

/**
 * 着せかえ画面の状態。タップした見た目はすぐ変え(端末の表示・ほかの画面のキャラクターにも反映)、
 * サーバーへは「変えた枠だけ」を、少し待ってまとめて1回で保存する。画面を閉じる・離れるときは待たずに送る。
 * childId は、この画面を開いている子ども(デモは無し=端末の表示だけ)。
 */
export function useDressUp(childId: string | undefined, onChange?: () => void): DressUp {
  const [equipped, setEquipped] = useState<EquippedAccessories>(getEquippedAccessories);
  const [progress, setProgress] = useState<CharacterProgress>(getCharacterProgress);
  const [saveFailed, setSaveFailed] = useState(false);

  // 開いている間にサーバーとの同期が終わっても、鍵(レベル)と着せかえの表示がついてくる
  useEffect(() => {
    const refreshProgress = () => setProgress(getCharacterProgress());
    const refreshEquipped = () => setEquipped(getEquippedAccessories());
    window.addEventListener("kanoha-reward-update", refreshProgress);
    window.addEventListener("kanoha-accessory-update", refreshEquipped);
    return () => {
      window.removeEventListener("kanoha-reward-update", refreshProgress);
      window.removeEventListener("kanoha-accessory-update", refreshEquipped);
    };
  }, []);

  // 別の画面へ移るときも、待っている保存を取りこぼさない
  useEffect(() => () => void flushEquippedSave(), []);

  const commit = useCallback(
    (before: EquippedAccessories, after: EquippedAccessories) => {
      saveEquippedAccessories(after);
      setEquipped(after);
      const changes = diffEquipped(before, after);
      if (Object.keys(changes).length === 0) return;
      onChange?.();
      queueEquippedSave(childId ?? null, changes, (result) => {
        setSaveFailed(result.status === "failed");
        // サーバーが着せなかった枠は、端末の表示もサーバーの値に戻っている
        if (result.rejected.length > 0) setEquipped(getEquippedAccessories());
      });
    },
    [childId, onChange],
  );

  const tap = useCallback(
    (slot: AccessoryCategory, itemId: string) => commit(equipped, equipAfterTap(equipped, slot, itemId)),
    [commit, equipped],
  );
  const wear = useCallback((preset: OutfitPreset) => commit(equipped, applyOutfit(equipped, preset)), [commit, equipped]);
  const reset = useCallback(() => commit(equipped, resetToDefaults(equipped)), [commit, equipped]);
  const finish = useCallback(() => void flushEquippedSave(), []);

  return { equipped, progress, saveFailed, tap, wear, reset, finish };
}
