"use client";

import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { KanohaCharacter } from "./KanohaCharacter";
import { speakCoachVoice } from "@/lib/audio/coachSpeech";
import {
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
    setAccessories(getEquippedAccessories());

    const handleAccessoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<EquippedAccessories>;
      if (customEvent.detail) {
        setAccessories(customEvent.detail);
      }
    };

    const handleCoachPraise = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; mood?: "celebrate" | "think" }>;
      if (customEvent.detail?.message) {
        setTapMessage(customEvent.detail.message);
        setTapMood(customEvent.detail.mood ?? "celebrate");
        if (customEvent.detail.mood !== "think") {
          setIsJumping(true);
          setTimeout(() => setIsJumping(false), 1200);
        }
        setTimeout(() => {
          setTapMessage(null);
          setTapMood(null);
        }, 4500);
      }
    };

    const handleProblemSolved = (e: Event) => {
      const customEvent = e as CustomEvent<{ correct?: boolean }>;
      const isCorrect = customEvent.detail?.correct ?? true;
      if (isCorrect) {
        setIsJumping(true);
        setTimeout(() => setIsJumping(false), 1200);
      }
    };

    window.addEventListener("kanoha-accessory-update", handleAccessoryChange);
    window.addEventListener("kanoha-problem-solved", handleProblemSolved);
    window.addEventListener("kanoha-coach-praise", handleCoachPraise);

    return () => {
      window.removeEventListener("kanoha-accessory-update", handleAccessoryChange);
      window.removeEventListener("kanoha-problem-solved", handleProblemSolved);
      window.removeEventListener("kanoha-coach-praise", handleCoachPraise);
    };
  }, []);

  const handleCharacterClick = () => {
    const randomMsg = TAP_REACTIONS[Math.floor(Math.random() * TAP_REACTIONS.length)];
    setTapMessage(randomMsg);
    setTapMood("celebrate");
    setIsJumping(true);
    void speakCoachVoice(randomMsg, "celebrate");

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
    <aside className={styles.coach} aria-label={`さゆきコーチ: ${displayMessage}`}>
      <div
        className={styles.speechBubble}
        onClick={() => void speakCoachVoice(displayMessage, activeMood)}
        title="クリックして 声を きいてみてね！"
        style={{ cursor: "pointer" }}
      >
        <p className={styles.speechText}>
          {displayMessage}
          <span style={{ marginLeft: "6px", fontSize: "14px", opacity: 0.8 }} aria-hidden="true">
            🔊
          </span>
        </p>
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

        <KanohaCharacter
          mood={activeMood}
          accessories={accessories}
        />
      </div>
    </aside>
  );
}
