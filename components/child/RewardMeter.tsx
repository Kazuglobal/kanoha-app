"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Sparkles } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { getRewardState, type RewardState } from "@/lib/rewards/rewardStore";
import { FiveYenRewardModal } from "./FiveYenRewardModal";

export function RewardMeter() {
  const [reward, setReward] = useState<RewardState>({
    currentCycleCount: 0,
    totalCorrectCount: 0,
    totalRewardYen: 0,
  });
  const [pulsing, setPulsing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setReward(getRewardState());

    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<RewardState>;
      if (customEvent.detail) {
        setReward(customEvent.detail);
        setPulsing(true);
        setTimeout(() => setPulsing(false), 800);
      }
    };

    const handleFiveYenEarned = () => {
      setShowModal(true);
    };

    window.addEventListener("kanoha-reward-update", handleUpdate);
    window.addEventListener("kanoha-five-yen-earned", handleFiveYenEarned);
    return () => {
      window.removeEventListener("kanoha-reward-update", handleUpdate);
      window.removeEventListener("kanoha-five-yen-earned", handleFiveYenEarned);
    };
  }, []);

  const needed = 10 - reward.currentCycleCount;

  return (
    <>
      <div className={styles.rewardMeterWrapper} title={`あと${needed}問正解で5円ゲット！`}>
        <motion.div
          className={`${styles.rewardMeterBadge} ${pulsing ? styles.rewardMeterPulse : ""}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowModal(true)}
          role="button"
          tabIndex={0}
          aria-label={`おこづかい ${reward.totalRewardYen}円、あと${needed}問で5円`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowModal(true);
            }
          }}
        >
          <div className={styles.rewardCoinIconWrap}>
            <Coins size={18} className={styles.rewardCoinIcon} />
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
                : `あと ${needed}問で +5円！`}
            </span>
          </div>
        </motion.div>
      </div>

      <FiveYenRewardModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
