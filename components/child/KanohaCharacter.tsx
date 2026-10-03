"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./KanohaCharacter.module.css";
import {
  DEFAULT_EQUIPPED,
  getEquippedAccessories,
  getLastEquippedCategory,
  type EquippedAccessories,
  type AccessoryCategory,
} from "@/lib/rewards/characterGrowthStore";

type Mood = "happy" | "think" | "celebrate";

interface KanohaCharacterProps {
  mood?: Mood;
  accessories?: EquippedAccessories;
  previewCategory?: AccessoryCategory;
  onClick?: () => void;
}

const SPRITES = {
  happy: "/images/character/kanoha-ref-happy.png",
  think: "/images/character/kanoha-ref-think.png",
  celebrate: "/images/character/kanoha-ref-celebrate.png",
  school: "/images/character/kanoha-ref-school.png",
  hoodie: "/images/character/kanoha-ref-hoodie.png",
  safari: "/images/character/kanoha-ref-safari.png",
  wizard: "/images/character/kanoha-ref-wizard.png",
  hero: "/images/character/kanoha-ref-hero.png",
  glassesRound: "/images/character/kanoha-ref-glasses-round.png",
  glassesStar: "/images/character/kanoha-ref-glasses-star.png",
  beret: "/images/character/kanoha-ref-beret.png",
  mittens: "/images/character/kanoha-ref-mittens.png",
  glovesGold: "/images/character/kanoha-ref-gloves-gold.png",
} as const;

export function getKanohaSprite(
  mood: Mood,
  accessories: EquippedAccessories,
  previewCategory?: AccessoryCategory,
): string {
  const clothes = () => {
    switch (accessories.clothes) {
    case "clothes_school":
      return SPRITES.school;
    case "clothes_safari":
      return SPRITES.safari;
    case "clothes_hoodie":
      return SPRITES.hoodie;
    case "clothes_wizard":
      return SPRITES.wizard;
    case "clothes_hero":
      return SPRITES.hero;
    default:
      return SPRITES[mood];
    }
  };
  const hat = () => {
    switch (accessories.hat) {
      case "hat_safari": return SPRITES.safari;
      case "hat_beret": return SPRITES.beret;
      case "hat_ribbon": return SPRITES.happy;
      case "hat_wizard": return SPRITES.wizard;
      case "hat_crown": return SPRITES.hero;
      default: return clothes();
    }
  };
  const glasses = () => {
    switch (accessories.glasses) {
      case "glasses_round": return SPRITES.glassesRound;
      case "glasses_star": return SPRITES.glassesStar;
      default: return clothes();
    }
  };
  const gloves = () => {
    switch (accessories.gloves) {
      case "gloves_mitten": return SPRITES.mittens;
      case "gloves_gold": return SPRITES.glovesGold;
      default: return clothes();
    }
  };

  switch (previewCategory) {
    case "hat": return hat();
    case "glasses": return glasses();
    case "gloves": return gloves();
    case "clothes": return clothes();
  }
  return clothes();
}

export function KanohaCharacter({ mood = "happy", accessories, previewCategory, onClick }: KanohaCharacterProps) {
  const [storedAccessories, setStoredAccessories] = useState<EquippedAccessories>(DEFAULT_EQUIPPED);
  const [storedCategory, setStoredCategory] = useState<AccessoryCategory>("clothes");

  useEffect(() => {
    setStoredAccessories(getEquippedAccessories());
    setStoredCategory(getLastEquippedCategory());
    const update = () => {
      setStoredAccessories(getEquippedAccessories());
      setStoredCategory(getLastEquippedCategory());
    };
    window.addEventListener("kanoha-accessory-update", update);
    return () => window.removeEventListener("kanoha-accessory-update", update);
  }, []);

  const src = getKanohaSprite(mood, accessories ?? storedAccessories, previewCategory ?? storedCategory);
  return (
    <div
      className={`${styles.stage} ${mood === "celebrate" ? styles.celebrate : ""}`}
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`かのはちゃん（${mood === "think" ? "かんがえちゅう" : mood === "celebrate" ? "よろこび" : "にっこり"}）`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <Image
        key={src}
        className={styles.sprite}
        src={src}
        width={1024}
        height={1536}
        alt=""
        draggable={false}
        unoptimized
      />
    </div>
  );
}
