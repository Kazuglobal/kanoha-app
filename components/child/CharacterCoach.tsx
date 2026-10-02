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

const TAP_REACTIONS = [
  "えへへ、いっしょに がんばろうね！",
  "きょうも たのしく べんきょう しよう！",
  "いつでも おうえん してるよっ♪",
  "すごいね！そのちょうし だよ！",
  "だいじょうぶ、ゆっくり かんがえてみてね！",
];

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
  const [tapMessage, setTapMessage] = useState<string | null>(null);
  const [tapMood, setTapMood] = useState<"happy" | "think" | "celebrate" | null>(null);
  const [isJumping, setIsJumping] = useState(false);
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

  const handleCharacterClick = () => {
    const randomMsg = TAP_REACTIONS[Math.floor(Math.random() * TAP_REACTIONS.length)];
    setTapMessage(randomMsg);
    setTapMood("celebrate");
    setIsJumping(true);

    setTimeout(() => {
      setIsJumping(false);
    }, 800);

    setTimeout(() => {
      setTapMessage(null);
      setTapMood(null);
    }, 3500);
  };

  const activeMood = tapMood || mood;
  const displayMessage = tapMessage || message;

  return (
    <aside className={styles.coach} aria-label={`かのはコーチ: ${displayMessage}`}>
      <div className={styles.speechBubble}>
        <p className={styles.speechText}>{displayMessage}</p>
        <span className={styles.speechArrow} aria-hidden="true" />
      </div>

      <div
        className={`${styles.coachAvatarWrapper} ${isJumping ? styles.celebrateJump : ""}`}
        data-mood={activeMood}
        aria-hidden="true"
        onClick={handleCharacterClick}
        title="タップしておはなししてみてね！"
        style={{ cursor: "pointer" }}
      >
        {/* Decorative sparkles for celebrate / think */}
        {activeMood === "celebrate" && (
          <div className={styles.celebrateStars}>
            <span className={styles.star1}>✦</span>
            <span className={styles.star2}>★</span>
            <span className={styles.star3}>✨</span>
          </div>
        )}
        {activeMood === "think" && (
          <div className={styles.thinkBubble}>
            <span>？</span>
          </div>
        )}

        {/* 立体的な WebGL 3D アニメ女の子キャラクター「かのはちゃん」 */}
        {mounted && use3D ? (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <ThreeCharacterCoach
              mood={activeMood}
              level={level}
              accessories={accessories}
            />
          </div>
        ) : (
          <AnimeCharacterGirl mood={activeMood} level={level} accessories={accessories} />
        )}
      </div>
    </aside>
  );
}
