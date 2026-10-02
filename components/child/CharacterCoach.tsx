"use client";

import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { AnimeCharacterGirl } from "./AnimeCharacterGirl";
import {
  getEquippedAccessories,
  type EquippedAccessories,
} from "@/lib/rewards/characterGrowthStore";

export function CharacterCoach({
  message,
  mood = "happy",
}: {
  message: string;
  mood?: "happy" | "think" | "celebrate";
}) {
  const [accessories, setAccessories] = useState<EquippedAccessories>(() => {
    if (typeof window !== "undefined") {
      return getEquippedAccessories();
    }
    return {
      hat: "hat_none",
      glasses: "glasses_round",
      gloves: "gloves_none",
      clothes: "clothes_school",
    };
  });

  useEffect(() => {
    const handleAccessoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<EquippedAccessories>;
      if (customEvent.detail) {
        setAccessories(customEvent.detail);
      }
    };
    window.addEventListener("kanoha-accessory-update", handleAccessoryChange);
    return () => {
      window.removeEventListener("kanoha-accessory-update", handleAccessoryChange);
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

        {/* 添付画像（コナン風ちびキャラ）の女の子バージョン（かのはちゃん） */}
        <AnimeCharacterGirl mood={mood} accessories={accessories} />
      </div>
    </aside>
  );
}
