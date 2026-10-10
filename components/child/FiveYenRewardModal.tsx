"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Trophy, X, Gift } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { getRewardState } from "@/lib/rewards/rewardStore";

interface FiveYenRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  earnedAmountYen?: number;
  onOpenExchange?: () => void;
}

export function FiveYenRewardModal({
  isOpen,
  onClose,
  earnedAmountYen = 5,
  onOpenExchange,
}: FiveYenRewardModalProps) {
  const [totalYen, setTotalYen] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const state = getRewardState();
      setTotalYen(state.totalRewardYen);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.rewardModalOverlay} role="dialog" aria-modal="true">
        <motion.div
          className={styles.rewardModalCard}
          initial={{ scale: 0.6, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          <button
            className={styles.rewardModalClose}
            onClick={onClose}
            aria-label="とじる"
            type="button"
          >
            <X size={20} />
          </button>

          {/* Confetti & Golden Sparkles */}
          <div className={styles.rewardModalConfetti} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                className={styles.confettiPiece}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  rotate: 0,
                }}
                animate={{
                  x: (Math.random() - 0.5) * 360,
                  y: (Math.random() - 0.7) * 320,
                  scale: [0, 1.2, 0.8],
                  rotate: Math.random() * 720,
                  opacity: [0, 1, 0.8],
                }}
                transition={{
                  duration: 1.2 + Math.random() * 0.5,
                  ease: "easeOut",
                }}
                style={{
                  backgroundColor: [
                    "#ffd700",
                    "#ff9f1c",
                    "#2ec4b6",
                    "#e71d36",
                    "#a78bfa",
                  ][i % 5],
                }}
              />
            ))}
          </div>

          {/* 3D-Style Spinning 5-Yen Coin */}
          <div className={styles.coinAnimationStage} aria-hidden="true">
            <motion.div
              className={styles.fiveYenCoin}
              animate={{
                rotateY: [0, 180, 360, 540, 720],
                y: [0, -18, 0, -8, 0],
                scale: [0.8, 1.15, 1],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatDelay: 2,
                ease: "easeInOut",
              }}
            >
              {/* Outer Golden Rim */}
              <div className={styles.coinOuter}>
                {/* Center Hole for 5 Yen */}
                <div className={styles.coinHole} />
                <div className={styles.coinRiceSprout}>🌾</div>
                <div className={styles.coinTextTop}>日本国</div>
                <div className={styles.coinTextCenter}>五円</div>
                <div className={styles.coinSparkle}>✦</div>
              </div>
            </motion.div>
          </div>

          <div className={styles.rewardModalContent}>
            <div className={styles.rewardModalBadge}>
              <Trophy size={18} />
              <span>10もん せいかい たっせい！</span>
            </div>

            <h2 className={styles.rewardModalTitle}>
              🪙 5えん ゲット！！
            </h2>

            <p className={styles.rewardModalLead}>
              すごい！ 10もん れんぞく せいかい したよ！<br />
              <strong>おうちの ひとに みせてね！</strong>
            </p>

            <div className={styles.rewardStatsBox}>
              <div className={styles.rewardStatItem}>
                <span>こんかい もらえた</span>
                <strong>+5 円</strong>
              </div>
              <div className={styles.rewardStatDivider} />
              <div className={styles.rewardStatItem}>
                <span>ぜんぶの おこづかい</span>
                <strong>{totalYen} 円</strong>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px", width: "100%" }}>
              {onOpenExchange && (
                <button
                  className={styles.secondaryButton}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                    borderColor: "#f59e0b",
                    color: "#b45309",
                    fontWeight: 900,
                  }}
                  type="button"
                  onClick={onOpenExchange}
                >
                  <Gift size={18} />
                  🎁 シールやおかしと こうかんする！
                </button>
              )}

              <button
                className={styles.primaryButton}
                style={{ width: "100%" }}
                type="button"
                onClick={onClose}
              >
                <Sparkles size={18} />
                つぎの 5えんを めざして つづける！
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
