"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, Shirt, RotateCcw } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import Image from "next/image";
import { KanohaCharacter, CHARACTER_DISPLAY_NAMES } from "./KanohaCharacter";
import {
  ACCESSORY_CATALOG,
  CHARACTER_DEFAULT_HAIRSTYLES,
  CHARACTER_DEFAULT_HAIR_COLORS,
  DEFAULT_EQUIPPED,
  getCharacterProgress,
  getEquippedAccessories,
  equipAccessory,
  type AccessoryCategory,
  type AccessoryItem,
  type CharacterId,
  type EquippedAccessories,
  type CharacterProgress,
} from "@/lib/rewards/characterGrowthStore";
import { saveEquipToServer } from "@/lib/rewards/rewardSync";

const DRESS_UP_TABS: { id: AccessoryCategory; label: string; icon: string }[] = [
  { id: "character", label: "キャラ", icon: "🌟" },
  { id: "clothes", label: "ふく", icon: "👕" },
  { id: "hairstyle", label: "かみがた", icon: "👧" },
  { id: "hair_color", label: "かみのいろ", icon: "🎨" },
  { id: "shoes", label: "くつ", icon: "👟" },
  { id: "shoes_color", label: "くつのいろ", icon: "🌈" },
  { id: "hat", label: "ぼうし", icon: "🎩" },
  { id: "glasses", label: "めがね", icon: "👓" },
  { id: "gloves", label: "てぶくろ", icon: "🧤" },
  { id: "accessory", label: "アクセ", icon: "✨" },
];

interface CharacterDressUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CharacterDressUpModal({ isOpen, onClose }: CharacterDressUpModalProps) {
  const [activeTab, setActiveTab] = useState<AccessoryCategory>("character");
  const [equipped, setEquipped] = useState<EquippedAccessories>(DEFAULT_EQUIPPED);
  const [progress, setProgress] = useState<CharacterProgress | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEquipped(getEquippedAccessories());
      setProgress(getCharacterProgress());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCharId = ((equipped.character ?? "char_kanoha") in CHARACTER_DISPLAY_NAMES
    ? (equipped.character ?? "char_kanoha")
    : "char_kanoha") as CharacterId;
  const currentCharName = CHARACTER_DISPLAY_NAMES[currentCharId];
  const currentDefaultHairstyle = CHARACTER_DEFAULT_HAIRSTYLES[currentCharId] ?? "hair_bun";
  const currentDefaultHairColor = CHARACTER_DEFAULT_HAIR_COLORS[currentCharId] ?? "hair_color_brown";

  const filteredItems = ACCESSORY_CATALOG.filter((item) => item.category === activeTab);

  const resolveCategoryDefault = (category: AccessoryCategory): string => {
    if (category === "hairstyle") return currentDefaultHairstyle;
    if (category === "hair_color") return currentDefaultHairColor;
    return DEFAULT_EQUIPPED[category] ?? "";
  };

  const handleSelect = (item: AccessoryItem) => {
    soundManager.playCorrect();

    const defaultId = resolveCategoryDefault(item.category);
    const isCurrent = (equipped[item.category] ?? defaultId) === item.id;
    // 選択中のアイテムを再タップした時は「はずす / デフォルト」に戻す
    const targetId = isCurrent ? defaultId : item.id;

    let updated = equipAccessory(item.category, targetId);
    void saveEquipToServer(item.category, targetId);

    // キャラクターを切り替えた時は、そのキャラクターの標準ヘアスタイル・髪色を初期セットする
    if (item.category === "character") {
      const nextCharId = (targetId in CHARACTER_DISPLAY_NAMES ? targetId : "char_kanoha") as CharacterId;
      const nextHairstyle = CHARACTER_DEFAULT_HAIRSTYLES[nextCharId] ?? "hair_bun";
      const nextHairColor = CHARACTER_DEFAULT_HAIR_COLORS[nextCharId] ?? "hair_color_brown";
      updated = equipAccessory("hairstyle", nextHairstyle);
      void saveEquipToServer("hairstyle", nextHairstyle);
      updated = equipAccessory("hair_color", nextHairColor);
      void saveEquipToServer("hair_color", nextHairColor);
    }

    setEquipped(updated);
  };

  const handleResetToDefault = () => {
    soundManager.playTap();
    const currentChar = currentCharId;
    const resetEquipped: EquippedAccessories = {
      ...DEFAULT_EQUIPPED,
      character: currentChar,
      hairstyle: CHARACTER_DEFAULT_HAIRSTYLES[currentChar] ?? "hair_bun",
      hair_color: CHARACTER_DEFAULT_HAIR_COLORS[currentChar] ?? "hair_color_brown",
    };
    for (const cat of Object.keys(DEFAULT_EQUIPPED) as AccessoryCategory[]) {
      const val = resetEquipped[cat];
      if (typeof val === "string") {
        equipAccessory(cat, val);
      }
    }
    setEquipped(resetEquipped);
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
            <h2 className={styles.dressUpTitle}>{currentCharName}を コーディネート！</h2>
            <p className={styles.dressUpSub}>
              すきな キャラクターと おようふく・かみがたを じゆうに えらんでね！
            </p>
          </div>

          <div className={styles.dressUpMainGrid}>
            {/* Full-body illustrated preview */}
            <div className={styles.dressUpPreviewStage}>
              <div className={styles.dressUp3DContainer}>
                <motion.div
                  key={JSON.stringify(equipped)}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 24 }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <KanohaCharacter
                    mood="happy"
                    accessories={equipped}
                    previewCategory={activeTab}
                  />
                </motion.div>
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
                {DRESS_UP_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`${styles.dressUpTab} ${activeTab === tab.id ? styles.dressUpTabActive : ""}`}
                    onClick={() => {
                      soundManager.playTap();
                      setActiveTab(tab.id);
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className={styles.dressUpItemsGrid}>
                {filteredItems.map((item) => {
                  const categoryDefault = resolveCategoryDefault(item.category);
                  const isCurrent = (equipped[item.category] ?? categoryDefault) === item.id;

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      className={`${styles.dressUpItemCard} ${isCurrent ? styles.dressUpItemCardActive : ""}`}
                      onClick={() => handleSelect(item)}
                    >
                      <div className={styles.dressUpItemIconWrap}>
                        {item.previewImage ? (
                          <Image
                            src={item.previewImage}
                            alt={item.name}
                            width={48}
                            height={48}
                            unoptimized
                            style={{
                              width: "44px",
                              height: "44px",
                              objectFit: "cover",
                              objectPosition: "top center",
                              borderRadius: "50%",
                            }}
                          />
                        ) : (
                          <span className={styles.dressUpItemIcon}>{item.icon}</span>
                        )}
                        {isCurrent && (
                          <span className={styles.dressUpCheckMark}>
                            <Check size={14} />
                          </span>
                        )}
                      </div>

                      <div className={styles.dressUpItemMeta}>
                        <strong className={styles.dressUpItemName}>{item.name}</strong>
                        <span className={styles.dressUpItemDesc}>{item.description}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.dressUpFooter}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleResetToDefault}
              style={{ minWidth: "140px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              title="ぜんぶ いつもの スタイルに もどす"
            >
              <RotateCcw size={16} />
              いつもの ふく
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => {
                soundManager.playCelebrate();
                onClose();
              }}
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
