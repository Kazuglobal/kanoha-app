"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { RubyAuto } from "./RubyText";

const particles = Array.from({ length: 12 }, (_, index) => ({
  angle: index * 30,
  color: ["#ff7355", "#ffc94a", "#3bbf9b", "#6479d4"][index % 4],
}));

export function RewardBurst({ unit }: { unit: string }) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={styles.rewardBurst}>
      <motion.div
        className={styles.rewardBadge}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.6, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <Sparkles aria-hidden="true" size={24} />
        <strong><RubyAuto text={unit} readingMode="kanji_with_ruby" /> マスター！</strong>
      </motion.div>
      <div aria-hidden="true" className={styles.rewardParticles}>
        {particles.map((particle, index) => (
          <motion.i
            data-reward-particle
            key={particle.angle}
            style={{ background: particle.color }}
            initial={reducedMotion ? false : { opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={reducedMotion ? { opacity: 1 } : {
              opacity: [0, 1, 0],
              x: Math.cos(particle.angle * Math.PI / 180) * 110,
              y: Math.sin(particle.angle * Math.PI / 180) * 80,
              scale: [0, 1, 0.5],
            }}
            transition={{ delay: 0.15 + index * 0.025, duration: 0.8 }}
          />
        ))}
      </div>
    </div>
  );
}
