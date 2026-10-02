"use client";

import React, { useEffect, useState } from "react";
import {
  getCharacterProgress,
  getEquippedAccessories,
  type EquippedAccessories,
} from "@/lib/rewards/characterGrowthStore";
import { AnimeCharacterGirl } from "./AnimeCharacterGirl";

interface ThreeCharacterCoachProps {
  mood?: "happy" | "think" | "celebrate";
  level?: number;
  accessories?: EquippedAccessories;
  onClick?: () => void;
}

/**
 * ThreeCharacterCoach
 * 添付画像（名探偵コナン風ちびキャラ）の女の子バージョン（かのはちゃん）を全画面で確実に表示。
 * リアルタイム着せ替え、レベルアップ、タップインタラクションに対応。
 */
export function ThreeCharacterCoach({
  mood = "happy",
  level: propsLevel,
  accessories: propsAccessories,
  onClick,
}: ThreeCharacterCoachProps) {
  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    if (propsLevel !== undefined) return propsLevel;
    if (typeof window !== "undefined") {
      return getCharacterProgress().currentLevel.level;
    }
    return 1;
  });

  const [currentAccessories, setCurrentAccessories] = useState<EquippedAccessories>(() => {
    if (propsAccessories) return propsAccessories;
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
    if (propsLevel !== undefined) setCurrentLevel(propsLevel);
  }, [propsLevel]);

  useEffect(() => {
    if (propsAccessories) setCurrentAccessories(propsAccessories);
  }, [propsAccessories]);

  // グローバルな着せ替え・レベルアップ更新イベントを監視
  useEffect(() => {
    const handleAccessoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<EquippedAccessories>;
      if (customEvent.detail && !propsAccessories) {
        setCurrentAccessories(customEvent.detail);
      }
    };

    const handleGrowthChange = () => {
      if (propsLevel === undefined) {
        setCurrentLevel(getCharacterProgress().currentLevel.level);
      }
    };

    window.addEventListener("kanoha-accessory-update", handleAccessoryChange);
    window.addEventListener("kanoha-reward-update", handleGrowthChange);
    window.addEventListener("kanoha-level-up", handleGrowthChange);

    return () => {
      window.removeEventListener("kanoha-accessory-update", handleAccessoryChange);
      window.removeEventListener("kanoha-reward-update", handleGrowthChange);
      window.removeEventListener("kanoha-level-up", handleGrowthChange);
    };
  }, [propsAccessories, propsLevel]);

  return (
    <AnimeCharacterGirl
      mood={mood}
      level={currentLevel}
      accessories={currentAccessories}
      onClick={onClick}
    />
  );
}
