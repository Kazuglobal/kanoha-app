"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, Lock, Shirt } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { ThreeCharacterCoach } from "./ThreeCharacterCoach";
import {
  ACCESSORY_CATALOG,
  getCharacterProgress,
  getEquippedAccessories,
  equipAccessory,
  isAccessoryUnlocked,
  type AccessoryItem,
  type EquippedAccessories,
  type CharacterProgress,
} from "@/lib/rewards/characterGrowthStore";

interface CharacterDressUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CharacterDressUpModal({ isOpen, onClose }: CharacterDressUpModalProps) {
  const [activeTab, setActiveTab] = useState<"hat" | "glasses" | "gloves">("hat");
  const [equipped, setEquipped] = useState<EquippedAccessories>(DEFAULT_EQUIPPED_FALLBACK);
  const [progress, setProgress] = useState<CharacterProgress | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEquipped(getEquippedAccessories());
      setProgress(getCharacterProgress());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentLevel = progress?.currentLevel.level ?? 1;
  const totalCorrect = progress?.totalCorrect ?? 0;

  const filteredItems = ACCESSORY_CATALOG.filter((item) => item.category === activeTab);

  const handleSelect = (item: AccessoryItem) => {
    if (!isAccessoryUnlocked(item, totalCorrect)) return;
    const updated = equipAccessory(item.category, item.id);
    setEquipped(updated);
  };

  return (
    <AnimatePresence>
      <div className={styles.rewardModalOverlay} role="dialog" aria-modal="true">
        <motion.div
          className={styles.dressUpModalCard}
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        >
          <button
            className={styles.rewardModalClose}
            onClick={onClose}
            aria-label="とじる"
            type="button"
          >
            <X size={20} />
          </button>

          <div className={styles.dressUpHeader}>
            <div className={styles.dressUpBadge}>
              <Shirt size={16} />
              <span>きがえ クローゼット</span>
            </div>
            <h2 className={styles.dressUpTitle}>かのはちゃんを コーディネート！</h2>
            <p className={styles.dressUpSub}>
              すきな アクセサリーを えらんでね！ もんだいを とくと あたらしい アイテムが ふえるよ！
            </p>
          </div>

          <div className={styles.dressUpMainGrid}>
            {/* Left: 3D Realtime Preview Stage */}
            <div className={styles.dressUpPreviewStage}>
              <div className={styles.dressUp3DContainer}>
                <ThreeCharacterCoach
                  mood="happy"
                  level={currentLevel}
                  accessories={equipped}
                />
              </div>

              {progress && (
                <div className={styles.dressUpGrowthBox}>
                  <div className={styles.dressUpGrowthLevelRow}>
                    <span className={styles.dressUpGrowthBadge}>Lv.{progress.currentLevel.level}</span>
                    <strong className={styles.dressUpGrowthName}>{progress.currentLevel.stageName}</strong>
                  </div>

                  <div className={styles.dressUpProgressBar}>
                    <div
                      className={styles.dressUpProgressFill}
                      style={{ width: `${progress.progressPercent}%` }}
                    />
                  </div>

                  <span className={styles.dressUpGrowthNextText}>
                    {progress.nextLevel
                      ? `つぎの しんかまで あと ${progress.neededForNextLevel} もん！`
                      : "🎉 さいこうレベル たっせい！"}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Accessory Picker */}
            <div className={styles.dressUpPickerSection}>
              {/* Category Tabs */}
              <div className={styles.dressUpTabs}>
                <button
                  type="button"
                  className={`${styles.dressUpTab} ${activeTab === "hat" ? styles.dressUpTabActive : ""}`}
                  onClick={() => setActiveTab("hat")}
                >
                  🎩 ぼうし
                </button>
                <button
                  type="button"
                  className={`${styles.dressUpTab} ${activeTab === "glasses" ? styles.dressUpTabActive : ""}`}
                  onClick={() => setActiveTab("glasses")}
                >
                  👓 めがね
                </button>
                <button
                  type="button"
                  className={`${styles.dressUpTab} ${activeTab === "gloves" ? styles.dressUpTabActive : ""}`}
                  onClick={() => setActiveTab("gloves")}
                >
                  🧤 てぶくろ
                </button>
              </div>

              {/* Items List */}
              <div className={styles.dressUpItemsGrid}>
                {filteredItems.map((item) => {
                  const unlocked = isAccessoryUnlocked(item, totalCorrect);
                  const isCurrent = equipped[item.category] === item.id;

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileHover={unlocked ? { scale: 1.03 } : {}}
                      whileTap={unlocked ? { scale: 0.96 } : {}}
                      className={`${styles.dressUpItemCard} ${isCurrent ? styles.dressUpItemCardActive : ""} ${!unlocked ? styles.dressUpItemLocked : ""}`}
                      onClick={() => handleSelect(item)}
                      disabled={!unlocked}
                    >
                      <div className={styles.dressUpItemIconWrap}>
                        <span className={styles.dressUpItemIcon}>{item.icon}</span>
                        {isCurrent && (
                          <span className={styles.dressUpCheckMark}>
                            <Check size={14} />
                          </span>
                        )}
                        {!unlocked && (
                          <div className={styles.dressUpLockOverlay}>
                            <Lock size={16} />
                          </div>
                        )}
                      </div>

                      <div className={styles.dressUpItemMeta}>
                        <strong className={styles.dressUpItemName}>{item.name}</strong>
                        {unlocked ? (
                          <span className={styles.dressUpItemDesc}>{item.description}</span>
                        ) : (
                          <span className={styles.dressUpItemUnlockNotice}>
                            🔒 Lv.{item.unlockLevel} で かいほう！
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.dressUpFooter}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={onClose}
              style={{ minWidth: "180px" }}
            >
              <Sparkles size={18} />
              できた！ これにする！
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

const DEFAULT_EQUIPPED_FALLBACK: EquippedAccessories = {
  hat: "hat_safari",
  glasses: "glasses_none",
  gloves: "gloves_mitten",
};
