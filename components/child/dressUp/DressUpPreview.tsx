"use client";

import { motion, type useAnimationControls } from "framer-motion";
import styles from "@/components/kanoha.module.css";
import type { AccessoryCategory, EquippedAccessories } from "@/lib/rewards/catalog";
import type { CharacterProgress } from "@/lib/rewards/characterGrowthStore";
import { KanohaCharacter } from "../KanohaCharacter";

interface DressUpPreviewProps {
  equipped: EquippedAccessories;
  progress: CharacterProgress;
  previewCategory?: AccessoryCategory;
  /** 着せかえたときの ぴょこっ(キャラクターを作り直さずに動かす) */
  controls: ReturnType<typeof useAnimationControls>;
}

/** 左側: 全身のプレビューと、せいちょう(レベル)の表示。 */
export function DressUpPreview({ equipped, progress, previewCategory, controls }: DressUpPreviewProps) {
  return (
    <div className={styles.dressUpPreviewStage}>
      <div className={styles.dressUp3DContainer}>
        <motion.div animate={controls} style={{ width: "100%", height: "100%" }}>
          <KanohaCharacter mood="happy" accessories={equipped} previewCategory={previewCategory} />
        </motion.div>
      </div>

      <div className={styles.dressUpGrowthBox}>
        <div className={styles.dressUpGrowthLevelRow}>
          <span className={styles.dressUpGrowthBadge}>Lv.{progress.currentLevel.level}</span>
          <strong className={styles.dressUpGrowthName}>{progress.currentLevel.stageName}</strong>
        </div>

        <div className={styles.dressUpProgressBar}>
          <div className={styles.dressUpProgressFill} style={{ width: `${progress.progressPercent}%` }} />
        </div>

        <span className={styles.dressUpGrowthNextText}>
          {progress.nextLevel ? `つぎの しんかまで あと ${progress.neededForNextLevel} もん！` : "🎉 さいこうレベル たっせい！"}
        </span>
      </div>
    </div>
  );
}
