"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, Lock, Shirt } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import { KanohaCharacter } from "./KanohaCharacter";
import {
  ACCESSORY_CATALOG,
  CHARACTER_CATALOG,
  DEFAULT_EQUIPPED,
  DEFAULT_CHARACTER_ID,
  getCharacterProgress,
  getEquippedAccessories,
  getSelectedCharacter,
  selectCharacter,
  equipAccessory,
  isAccessoryUnlocked,
  type AccessoryCategory,
  type AccessoryItem,
  type CharacterId,
  type EquippedAccessories,
  type CharacterProgress,
} from "@/lib/rewards/characterGrowthStore";
import { saveEquipToServer } from "@/lib/rewards/rewardSync";

type DressUpTabId = "character" | AccessoryCategory;

const DRESS_UP_TABS: { id: DressUpTabId; label: string; icon: string }[] = [
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
  const [activeTab, setActiveTab] = useState<DressUpTabId>("clothes");
  const [selectedChar, setSelectedChar] = useState<CharacterId>(DEFAULT_CHARACTER_ID);
  const [equipped, setEquipped] = useState<EquippedAccessories>(DEFAULT_EQUIPPED);
  const [progress, setProgress] = useState<CharacterProgress | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEquipped(getEquippedAccessories());
      setSelectedChar(getSelectedCharacter());
      setProgress(getCharacterProgress());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalCorrect = progress?.totalCorrect ?? 0;

  const filteredItems =
    activeTab === "character"
      ? []
      : ACCESSORY_CATALOG.filter((item) => item.category === activeTab);

  const currentCharacterMeta =
    CHARACTER_CATALOG.find((c) => c.id === selectedChar) ?? CHARACTER_CATALOG[0];

  const handleSelectCharacter = (charId: CharacterId) => {
    soundManager.playCorrect();
    const updatedChar = selectCharacter(charId);
    setSelectedChar(updatedChar);
  };

  const handleSelect = (item: AccessoryItem) => {
    if (!isAccessoryUnlocked(item, totalCorrect)) return;
    soundManager.playCorrect();
    const updated = equipAccessory(item.category, item.id);
    setEquipped(updated);
    void saveEquipToServer(item.category, item.id);
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
            <h2 className={styles.dressUpTitle}>
              {currentCharacterMeta.name}を コーディネート！
            </h2>
            <p className={styles.dressUpSub}>
              すきな キャラクターと きせかえグッズを えらんでね！ もんだいを とくと あたらしい アイテムが ふえるよ！
            </p>
          </div>

          <div className={styles.dressUpMainGrid}>
            {/* Full-body illustrated preview */}
            <div className={styles.dressUpPreviewStage}>
              <div className={styles.dressUp3DContainer}>
                <motion.div
                  key={`${selectedChar}-${JSON.stringify(equipped)}`}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 24 }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <KanohaCharacter
                    mood="happy"
                    characterId={selectedChar}
                    accessories={{ ...equipped, character: selectedChar }}
                    previewCategory={activeTab === "character" ? undefined : activeTab}
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

            {/* Right: Character & Accessory Picker */}
            <div className={styles.dressUpPickerSection}>
              {/* Quick Character Switcher Bar */}
              <div className={styles.dressUpCharacterBar} aria-label="キャラクターをえらぶ">
                {CHARACTER_CATALOG.map((char) => {
                  const isActive = selectedChar === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      className={`${styles.dressUpCharacterChip} ${
                        isActive ? styles.dressUpCharacterChipActive : ""
                      }`}
                      onClick={() => handleSelectCharacter(char.id)}
                    >
                      <span className={styles.dressUpCharacterThumb}>
                        <Image
                          src={char.previewImage}
                          width={48}
                          height={72}
                          alt={char.name}
                          className={styles.dressUpCharacterThumbImg}
                          unoptimized
                        />
                      </span>
                      <span className={styles.dressUpCharacterName}>{char.name}</span>
                    </button>
                  );
                })}
              </div>

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
                {activeTab === "character"
                  ? CHARACTER_CATALOG.map((char) => {
                      const isCurrent = selectedChar === char.id;
                      return (
                        <motion.button
                          key={char.id}
                          type="button"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          className={`${styles.dressUpItemCard} ${
                            isCurrent ? styles.dressUpItemCardActive : ""
                          }`}
                          onClick={() => handleSelectCharacter(char.id)}
                        >
                          <div className={styles.dressUpItemIconWrap}>
                            <Image
                              src={char.previewImage}
                              width={40}
                              height={60}
                              alt={char.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: "top center",
                                borderRadius: "10px",
                              }}
                              unoptimized
                            />
                            {isCurrent && (
                              <span className={styles.dressUpCheckMark}>
                                <Check size={14} />
                              </span>
                            )}
                          </div>

                          <div className={styles.dressUpItemMeta}>
                            <strong className={styles.dressUpItemName}>
                              {char.icon} {char.name}
                            </strong>
                            <span className={styles.dressUpItemDesc}>{char.description}</span>
                          </div>
                        </motion.button>
                      );
                    })
                  : filteredItems.map((item) => {
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
