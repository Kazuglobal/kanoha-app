"use client";

import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import type { EquippedAccessories } from "@/lib/rewards/catalog";
import {
  OUTFIT_PRESETS,
  isOutfitUnlocked,
  isOutfitWorn,
  outfitIcons,
  outfitRemainingCorrect,
  type OutfitPreset,
} from "@/lib/rewards/outfits";
import { OUTFIT_TAB, panelAttributes } from "./tabs";

interface OutfitGridProps {
  equipped: EquippedAccessories;
  totalCorrect: number;
  onWear: (preset: OutfitPreset) => void;
}

/** コーデ(テーマ別の着せかえセット)。ワンタップで いくつかの枠をまとめて着せる。着ているセットは もう一度おしても そのまま。 */
export function OutfitGrid({ equipped, totalCorrect, onWear }: OutfitGridProps) {
  return (
    <div className={styles.dressUpItemsGrid} {...panelAttributes(OUTFIT_TAB)}>
      {OUTFIT_PRESETS.map((preset) => {
        const locked = !isOutfitUnlocked(preset, totalCorrect);
        const remaining = outfitRemainingCorrect(preset, totalCorrect);
        const worn = !locked && isOutfitWorn(equipped, preset);
        return (
          <motion.button
            key={preset.id}
            type="button"
            aria-disabled={locked}
            aria-current={worn ? "true" : undefined}
            whileHover={locked ? undefined : { scale: 1.03 }}
            whileTap={locked ? undefined : { scale: 0.96 }}
            className={`${styles.dressUpItemCard} ${worn ? styles.dressUpItemCardActive : ""} ${locked ? styles.dressUpItemLocked : ""}`}
            onClick={() => {
              if (!locked) onWear(preset);
            }}
          >
            <div className={styles.dressUpItemIconWrap}>
              <span className={styles.dressUpItemIcon}>{preset.icon}</span>
              {worn && (
                <span className={styles.dressUpCheckMark}>
                  <Check size={14} />
                </span>
              )}
              {locked && (
                <span className={styles.dressUpLockOverlay}>
                  <Lock size={16} aria-hidden="true" />
                </span>
              )}
            </div>

            <div className={styles.dressUpItemMeta}>
              <strong className={styles.dressUpItemName}>{preset.name}</strong>
              {locked ? (
                <span className={styles.dressUpItemUnlockNotice}>あと {remaining}もん で つかえるよ</span>
              ) : (
                <span className={styles.dressUpItemDesc} aria-hidden="true">
                  {outfitIcons(preset).join(" ")}
                </span>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
