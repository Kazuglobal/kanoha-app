"use client";

import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { LovableKanohaCharacter } from "./LovableKanohaCharacter";
import { speakCoachVoice } from "@/lib/audio/coachSpeech";
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

    const handleProblemSolved = (e: Event) => {
      const customEvent = e as CustomEvent<{ correct?: boolean }>;
      const isCorrect = customEvent.detail?.correct ?? true;
      if (isCorrect) {
        const cheerMsg = "やったぁーーっ！！だいせいかい！！すごいっ✨";
        setTapMessage(cheerMsg);
        setTapMood("celebrate");
        setIsJumping(true);
        void speakCoachVoice(cheerMsg, "celebrate");
        setTimeout(() => setIsJumping(false), 1200);
        setTimeout(() => {
          setTapMessage(null);
          setTapMood(null);
        }, 4500);
      }
    };

    window.addEventListener("kanoha-accessory-update", handleAccessoryChange);
    window.addEventListener("kanoha-reward-update", handleGrowthChange);
    window.addEventListener("kanoha-level-up", handleGrowthChange);
    window.addEventListener("kanoha-problem-solved", handleProblemSolved);

    return () => {
      window.removeEventListener("kanoha-accessory-update", handleAccessoryChange);
      window.removeEventListener("kanoha-reward-update", handleGrowthChange);
      window.removeEventListener("kanoha-level-up", handleGrowthChange);
      window.removeEventListener("kanoha-problem-solved", handleProblemSolved);
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
    <aside className={styles.coach} aria-label={`かのはコーチ: ${displayMessage}`}>
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

        {/* 誰からも愛される自然なマスコット「かのはちゃん」 */}
        <LovableKanohaCharacter
          mood={activeMood}
          level={level}
          accessories={accessories}
          celebrating={activeMood === "celebrate"}
        />
      </div>
    </aside>
  );
}
