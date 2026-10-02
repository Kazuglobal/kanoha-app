"use client";

import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { ThreeCharacterCoach } from "./ThreeCharacterCoach";
import { AnimeCharacterGirl } from "./AnimeCharacterGirl";
import {
  getCharacterProgress,
  getEquippedAccessories,
  DEFAULT_EQUIPPED,
  type EquippedAccessories,
} from "@/lib/rewards/characterGrowthStore";

export function CharacterCoach({
  message,
  mood = "happy",
}: {
  message: string;
  mood?: "happy" | "think" | "celebrate";
}) {
  const [mounted, setMounted] = useState(false);
  const [use3D, setUse3D] = useState(false);
  const [level, setLevel] = useState(1);
  const [accessories, setAccessories] = useState<EquippedAccessories>(() => {
    if (typeof window !== "undefined") {
      return getEquippedAccessories();
    }
    return DEFAULT_EQUIPPED;
  });

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setUse3D(Boolean(gl));
    } catch {
      setUse3D(false);
    }

    setLevel(getCharacterProgress().currentLevel.level);
    setAccessories(getEquippedAccessories());

    const handleAccessoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<EquippedAccessories>;
      if (customEvent.detail) {
        setAccessories(customEvent.detail);
      }
    };

    const handleGrowthChange = () => {
      setLevel(getCharacterProgress().currentLevel.level);
    };

    window.addEventListener("kanoha-accessory-update", handleAccessoryChange);
    window.addEventListener("kanoha-reward-update", handleGrowthChange);
    window.addEventListener("kanoha-level-up", handleGrowthChange);

    return () => {
      window.removeEventListener("kanoha-accessory-update", handleAccessoryChange);
      window.removeEventListener("kanoha-reward-update", handleGrowthChange);
      window.removeEventListener("kanoha-level-up", handleGrowthChange);
    };
  }, []);

  return (
    <aside className={styles.coach} aria-label={`かのはコーチ: ${message}`}>
      <div className={styles.speechBubble}>
        <p className={styles.speechText}>{message}</p>
        <span className={styles.speechArrow} aria-hidden="true" />
      </div>

      <div className={styles.coachAvatarWrapper} data-mood={mood} aria-hidden="true">
        {/* Decorative sparkles for celebrate / think */}
        {mood === "celebrate" && (
          <div className={styles.celebrateStars}>
            <span className={styles.star1}>✦</span>
            <span className={styles.star2}>★</span>
            <span className={styles.star3}>✨</span>
          </div>
        )}
        {mood === "think" && (
          <div className={styles.thinkBubble}>
            <span>？</span>
          </div>
        )}

        {/* WebGL 3D Three.js Character when supported */}
        {mounted && use3D ? (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <ThreeCharacterCoach mood={mood} level={level} accessories={accessories} />
          </div>
        ) : (
          /* High-quality SVG Mascot Fallback (For SSR / Test / Non-WebGL environments) */
          <AnimeCharacterGirl mood={mood} level={level} accessories={accessories} />
        )}
      </div>
    </aside>
  );
}
