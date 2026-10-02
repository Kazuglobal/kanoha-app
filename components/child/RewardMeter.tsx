"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Shirt, Sparkles } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { getRewardState, type RewardState } from "@/lib/rewards/rewardStore";
import {
  getCharacterProgress,
  type CharacterProgress,
  type GrowthLevelInfo,
} from "@/lib/rewards/characterGrowthStore";
import { FiveYenRewardModal } from "./FiveYenRewardModal";
import { CharacterDressUpModal } from "./CharacterDressUpModal";
import { LevelUpModal } from "./LevelUpModal";

export function RewardMeter() {
  const [reward, setReward] = useState<RewardState>({
    currentCycleCount: 0,
    totalCorrectCount: 0,
    totalRewardYen: 0,
  });
  const [progress, setProgress] = useState<CharacterProgress | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showDressUpModal, setShowDressUpModal] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<GrowthLevelInfo | null>(null);

  useEffect(() => {
    setReward(getRewardState());
    setProgress(getCharacterProgress());

    const handleRewardUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<RewardState>;
      if (customEvent.detail) {
        setReward(customEvent.detail);
        setProgress(getCharacterProgress());
        setPulsing(true);
        setTimeout(() => setPulsing(false), 800);
      }
    };

    const handleFiveYenEarned = () => {
      setShowRewardModal(true);
    };

    const handleLevelUp = (event: Event) => {
      const customEvent = event as CustomEvent<{ newLevel: GrowthLevelInfo }>;
      if (customEvent.detail?.newLevel) {
        setLevelUpInfo(customEvent.detail.newLevel);
      }
    };

    window.addEventListener("kanoha-reward-update", handleRewardUpdate);
    window.addEventListener("kanoha-five-yen-earned", handleFiveYenEarned);
    window.addEventListener("kanoha-level-up", handleLevelUp);

    return () => {
      window.removeEventListener("kanoha-reward-update", handleRewardUpdate);
      window.removeEventListener("kanoha-five-yen-earned", handleFiveYenEarned);
      window.removeEventListener("kanoha-level-up", handleLevelUp);
    };
  }, []);

  const neededForFiveYen = 10 - reward.currentCycleCount;

  return (
    <>
      <div className={styles.rewardMeterWrapper}>
        {/* おこづかいメーター (10問で5円) */}
        <motion.div
          className={`${styles.rewardMeterBadge} ${pulsing ? styles.rewardMeterPulse : ""}`}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowRewardModal(true)}
          role="button"
          tabIndex={0}
          title={`あと${neededForFiveYen}問正解で5円ゲット！`}
          aria-label={`おこづかい ${reward.totalRewardYen}円、あと${neededForFiveYen}問で5円`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowRewardModal(true);
            }
          }}
        >
          <div className={styles.rewardCoinIconWrap}>
            <Coins size={17} className={styles.rewardCoinIcon} />
          </div>

          <div className={styles.rewardMeterInfo}>
            <div className={styles.rewardAmountRow}>
              <span className={styles.rewardYenLabel}>おこづかい</span>
              <strong className={styles.rewardYenValue}>{reward.totalRewardYen}円</strong>
            </div>

            <div className={styles.rewardMiniTrack}>
              <div
                className={styles.rewardMiniFill}
                style={{ width: `${(reward.currentCycleCount / 10) * 100}%` }}
              />
            </div>

            <span className={styles.rewardCountdown}>
              {reward.currentCycleCount === 0
                ? "あと10問で+5円！"
                : `あと${neededForFiveYen}問で+5円！`}
            </span>
          </div>
        </motion.div>

        {/* きがえ & 成長バッジ (クローゼットボタン) */}
        <motion.button
          type="button"
          className={styles.dressUpOpenButton}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowDressUpModal(true)}
          title="かのはちゃんの きがえ & せいちょう"
          aria-label="かのはちゃんの きがえ をひらく"
        >
          <div className={styles.dressUpIconWrap}>
            <Shirt size={16} />
          </div>
          <div className={styles.dressUpButtonTextCol}>
            <span className={styles.dressUpLevelTag}>
              Lv.{progress?.currentLevel.level ?? 1} {progress?.currentLevel.stageName ?? "タネ"}
            </span>
            <strong className={styles.dressUpActionLabel}>きがえ</strong>
          </div>
        </motion.button>
      </div>

      {/* 5円獲得セレブレーションモーダル */}
      <FiveYenRewardModal
        isOpen={showRewardModal}
        onClose={() => setShowRewardModal(false)}
      />

      {/* きがえクローゼットモーダル */}
      <CharacterDressUpModal
        isOpen={showDressUpModal}
        onClose={() => setShowDressUpModal(false)}
      />

      {/* レベルアップお祝いモーダル */}
      {levelUpInfo && (
        <LevelUpModal
          isOpen={Boolean(levelUpInfo)}
          newLevel={levelUpInfo}
          onClose={() => setLevelUpInfo(null)}
          onOpenDressUp={() => setShowDressUpModal(true)}
        />
      )}
    </>
  );
}
