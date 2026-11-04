"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { X } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import type { AccessoryItem } from "@/lib/rewards/catalog";
import { currentCharacterId } from "@/lib/rewards/dressUp";
import type { OutfitPreset } from "@/lib/rewards/outfits";
import { CHARACTER_DISPLAY_NAMES } from "./KanohaCharacter";
import { DressUpFooter } from "./dressUp/DressUpFooter";
import { DressUpHeader } from "./dressUp/DressUpHeader";
import { DressUpPicker } from "./dressUp/DressUpPicker";
import { DressUpPreview } from "./dressUp/DressUpPreview";
import { previewSlot, type DressUpTabId } from "./dressUp/tabs";
import { useDressUp } from "./dressUp/useDressUp";

interface CharacterDressUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** いま開いている子ども。着せかえの保存先(デモは無し=端末の表示だけ) */
  childId?: string;
}

/** きがえクローゼット。閉じているときは何も作らない(開くたびに、いまの着せかえとレベルを読み直す)。 */
export function CharacterDressUpModal({ isOpen, onClose, childId }: CharacterDressUpModalProps) {
  return <AnimatePresence>{isOpen && <DressUpDialog key="dress-up" onClose={onClose} childId={childId} />}</AnimatePresence>;
}

function DressUpDialog({ onClose, childId }: { onClose: () => void; childId?: string }) {
  const [activeTab, setActiveTab] = useState<DressUpTabId>("character");
  const pop = useAnimationControls();
  const bump = useCallback(() => void pop.start({ scale: [1, 1.05, 1], transition: { duration: 0.28 } }), [pop]);
  const { equipped, progress, saveFailed, tap, wear, reset, finish } = useDressUp(childId, bump);

  const close = () => {
    finish();
    onClose();
  };
  const selectItem = (item: AccessoryItem) => {
    soundManager.playCorrect();
    tap(item.category, item.id);
  };
  const wearOutfit = (preset: OutfitPreset) => {
    soundManager.playCorrect();
    wear(preset);
  };

  return (
    <motion.div
      className={styles.rewardModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dress-up-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={styles.dressUpModalCard}
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
      >
        <button className={styles.rewardModalClose} onClick={close} aria-label="とじる" type="button">
          <X size={20} />
        </button>

        <DressUpHeader characterName={CHARACTER_DISPLAY_NAMES[currentCharacterId(equipped)]} titleId="dress-up-title" />

        <div className={styles.dressUpMainGrid}>
          <DressUpPreview equipped={equipped} progress={progress} previewCategory={previewSlot(activeTab)} controls={pop} />

          <DressUpPicker
            tab={activeTab}
            onTab={(tab) => {
              soundManager.playTap();
              setActiveTab(tab);
            }}
            equipped={equipped}
            totalCorrect={progress.totalCorrect}
            onSelectItem={selectItem}
            onWear={wearOutfit}
          />
        </div>

        <DressUpFooter
          saveFailed={saveFailed}
          onReset={() => {
            soundManager.playTap();
            reset();
          }}
          onDone={() => {
            soundManager.playCelebrate();
            close();
          }}
        />
      </motion.div>
    </motion.div>
  );
}
