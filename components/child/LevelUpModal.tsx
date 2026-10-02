"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Trophy, X, ArrowRight, Shirt } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { ThreeCharacterCoach } from "./ThreeCharacterCoach";
import type { GrowthLevelInfo } from "@/lib/rewards/characterGrowthStore";

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDressUp?: () => void;
  newLevel: GrowthLevelInfo;
}

export function LevelUpModal({
  isOpen,
  onClose,
  onOpenDressUp,
  newLevel,
}: LevelUpModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.rewardModalOverlay} role="dialog" aria-modal="true">
        <motion.div
          className={styles.levelUpModalCard}
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

          {/* Confetti */}
          <div className={styles.rewardModalConfetti} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                className={styles.confettiPiece}
                initial={{ x: 0, y: 0, scale: 0, rotate: 0 }}
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

          {/* 3D Preview with celebrate motion */}
          <div className={styles.levelUp3DStage} aria-hidden="true">
            <ThreeCharacterCoach mood="celebrate" level={newLevel.level} />
          </div>

          <div className={styles.rewardModalContent}>
            <div className={styles.levelUpBadge}>
              <Trophy size={18} />
              <span>🎉 レベルアップ！！</span>
            </div>

            <h2 className={styles.levelUpTitle}>
              Lv.{newLevel.level} {newLevel.stageName} に しんか！
            </h2>

            <p className={styles.levelUpSubtitle}>
              たくさん せいかい して、かのはちゃんが おおきく せいちょう したよ！
            </p>

            <div className={styles.levelUpRewardBox}>
              <div className={styles.levelUpRewardHeader}>
                <Sparkles size={18} className={styles.levelUpSparkleIcon} />
                <strong>あたらしい アイテムが かいほうされたよ！</strong>
              </div>
              <p className={styles.levelUpRewardText}>
                {newLevel.rewardDescription}
              </p>
            </div>

            <div className={styles.levelUpActions}>
              {onOpenDressUp && (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDressUp();
                  }}
                >
                  <Shirt size={18} />
                  さっそく きがえる！
                </button>
              )}

              <button
                className={styles.secondaryButton}
                type="button"
                onClick={onClose}
              >
                べんきょうを つづける
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
