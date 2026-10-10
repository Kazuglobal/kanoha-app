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

const HAIR_COLOR_FILTERS: Record<string, string> = {
  hair_color_brown: "none",
  hair_color_black: "brightness(0.4) contrast(1.3) saturate(0.2)",
  hair_color_pink: "sepia(0.65) hue-rotate(295deg) saturate(2.4) brightness(1.05)",
  hair_color_gold: "sepia(0.85) hue-rotate(15deg) saturate(3.2) brightness(1.2)",
  hair_color_blue: "sepia(0.65) hue-rotate(170deg) saturate(2.5) brightness(1.1)",
};

const HAIRSTYLE_SPRITES: Record<string, { src: string; clip: string }> = {
  hair_bun: { src: SPRITES.happy, clip: "polygon(18% 2%, 82% 2%, 82% 35%, 18% 35%)" },
  hair_bob: { src: SPRITES.hoodie, clip: "polygon(22% 4%, 78% 4%, 78% 34%, 22% 34%)" },
  hair_twintail: { src: SPRITES.school, clip: "polygon(15% 2%, 85% 2%, 85% 36%, 15% 36%)" },
  hair_pony: { src: SPRITES.safari, clip: "polygon(20% 2%, 82% 2%, 82% 35%, 20% 35%)" },
  hair_long_wave: { src: SPRITES.wizard, clip: "polygon(16% 2%, 84% 2%, 84% 38%, 16% 38%)" },
};

const SHOES_COLOR_FILTERS: Record<string, string> = {
  shoes_color_pink: "sepia(0.55) hue-rotate(295deg) saturate(2.5) brightness(1.05)",
  shoes_color_white: "brightness(2.2) saturate(0.1)",
  shoes_color_brown: "sepia(0.9) hue-rotate(-25deg) brightness(0.65) contrast(1.2)",
  shoes_color_blue: "sepia(0.65) hue-rotate(185deg) saturate(2.6) brightness(1.05)",
  shoes_color_gold: "sepia(0.85) hue-rotate(20deg) saturate(3.5) brightness(1.25)",
};

const SHOES_SPRITES: Record<string, string> = {
  shoes_sneaker: SPRITES.school,
  shoes_boots: SPRITES.safari,
  shoes_pumps: SPRITES.happy,
  shoes_magical: SPRITES.wizard,
  shoes_hero: SPRITES.hero,
};

export function getKanohaSprite(
  mood: Mood,
  accessories: EquippedAccessories,
  _previewCategory?: AccessoryCategory,
): string {
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
}

export function KanohaCharacter({ mood = "happy", accessories, onClick }: KanohaCharacterProps) {
  const [storedAccessories, setStoredAccessories] = useState<EquippedAccessories>(DEFAULT_EQUIPPED);

  useEffect(() => {
    setStoredAccessories(getEquippedAccessories());
    const update = () => {
      setStoredAccessories(getEquippedAccessories());
    };
    window.addEventListener("kanoha-accessory-update", update);
    return () => window.removeEventListener("kanoha-accessory-update", update);
  }, []);

  const activeAccessories = accessories ?? storedAccessories;

  // 1. ベース衣装
  const baseSrc = getKanohaSprite(mood, activeAccessories);

  // 2. メガネレイヤー
  let glassesSrc: string | null = null;
  if (activeAccessories.glasses === "glasses_round") {
    glassesSrc = SPRITES.glassesRound;
  } else if (activeAccessories.glasses === "glasses_star") {
    glassesSrc = SPRITES.glassesStar;
  }

  // 3. 手袋レイヤー
  let glovesSrc: string | null = null;
  if (activeAccessories.gloves === "gloves_mitten") {
    glovesSrc = SPRITES.mittens;
  } else if (activeAccessories.gloves === "gloves_gold") {
    glovesSrc = SPRITES.glovesGold;
  }

  // 4. 帽子レイヤー
  // まほうの服のスプライトには魔法の帽子が描き込まれている。
  // 別の帽子(またはなし)を選んだ場合は、頭部分を帽子なしのスプライトに差し替えて消す。
  const bakedHat = activeAccessories.clothes === "clothes_wizard" ? "hat_wizard" : null;
  const hideBakedHat = bakedHat !== null && activeAccessories.hat !== bakedHat;

  let hatSrc: string | null = null;
  let hatClip = "polygon(20% 0%, 82% 0%, 82% 22%, 20% 22%)";
  if (activeAccessories.hat === "hat_beret") {
    hatSrc = SPRITES.beret;
  } else if (activeAccessories.hat === "hat_safari" && activeAccessories.clothes !== "clothes_safari") {
    hatSrc = SPRITES.safari;
  } else if (activeAccessories.hat === "hat_wizard" && activeAccessories.clothes !== "clothes_wizard") {
    hatSrc = SPRITES.wizard;
    hatClip = "polygon(15% 0%, 100% 0%, 100% 36%, 15% 36%)";
  } else if (activeAccessories.hat === "hat_crown" && activeAccessories.clothes !== "clothes_hero") {
    hatSrc = SPRITES.hero;
    hatClip = "polygon(36% 5%, 64% 5%, 64% 15%, 36% 15%)";
  } else if (activeAccessories.hat === "hat_ribbon") {
    // ピンクのリボン: 他の帽子付き衣装でもリボンを頭の上に乗せる
    hatSrc = SPRITES.happy;
    hatClip = "polygon(22% 3%, 62% 3%, 62% 22%, 22% 22%)";
  }

  // 5. 髪型レイヤー (Hairstyle)
  const hairStyle = activeAccessories.hairstyle ?? "hair_bun";
  const hairColor = activeAccessories.hair_color ?? "hair_color_brown";
  const hairFilter = HAIR_COLOR_FILTERS[hairColor] ?? "none";

  // 6. 靴レイヤー (Shoes & Shoes Color)
  const shoesType = activeAccessories.shoes ?? "shoes_sneaker";
  const shoesColor = activeAccessories.shoes_color ?? "shoes_color_pink";
  const shoesFilter = SHOES_COLOR_FILTERS[shoesColor] ?? "none";
  const shoesBaseSrc = SHOES_SPRITES[shoesType] ?? SPRITES.happy;

  // 7. アクセサリー (Accessory)
  const accessoryType = activeAccessories.accessory ?? "acc_none";

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
      <div className={styles.characterContainer}>
        {/* レイヤー0: 天使の翼 (背中アクセサリ) */}
        {accessoryType === "acc_wings" && (
          <div className={styles.wingsLayer} aria-hidden="true">
            <span style={{ fontSize: "52px", transform: "scaleX(-1) rotate(-15deg)" }}>🪽</span>
            <span style={{ fontSize: "52px", transform: "rotate(-15deg)" }}>🪽</span>
          </div>
        )}

        {/* レイヤー1: ベース全身衣装 */}
        <Image
          key={`base-${baseSrc}`}
          className={styles.sprite}
          src={baseSrc}
          width={1024}
          height={1536}
          alt=""
          draggable={false}
          unoptimized
          style={hideBakedHat ? { clipPath: "polygon(0% 36%, 100% 36%, 100% 100%, 0% 100%)" } : undefined}
        />

        {/* レイヤー1b: 服に描かれた帽子を消すための帽子なしの頭 */}
        {hideBakedHat && (
          <Image
            key={`head-${SPRITES.happy}`}
            className={styles.overlaySprite}
            src={SPRITES.happy}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 36%, 0% 36%)" }}
          />
        )}

        {/* レイヤー1c: 髪型＆髪色オーバーレイ */}
        {hairFilter !== "none" && (
          <Image
            key={`hair-color-${hairColor}-${hairStyle}`}
            className={styles.overlaySprite}
            src={HAIRSTYLE_SPRITES[hairStyle]?.src ?? SPRITES.happy}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{
              clipPath: HAIRSTYLE_SPRITES[hairStyle]?.clip ?? "polygon(18% 2%, 82% 2%, 82% 35%, 18% 35%)",
              filter: hairFilter,
              mixBlendMode: "multiply",
              opacity: 0.85,
            }}
          />
        )}

        {/* レイヤー1d: 靴＆靴色オーバーレイ (足元 74%〜100%) */}
        {/* レイヤー1d: 靴＆靴色オーバーレイ (カスタム指定時のみ描画) */}
        {((activeAccessories.shoes && activeAccessories.shoes !== "shoes_sneaker") ||
          (activeAccessories.shoes_color && activeAccessories.shoes_color !== "shoes_color_pink")) && (
          <Image
            key={`shoes-${shoesType}-${shoesColor}`}
            className={styles.overlaySprite}
            src={shoesBaseSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{
              clipPath: "polygon(24% 75%, 76% 75%, 76% 100%, 24% 100%)",
              filter: shoesFilter !== "none" ? shoesFilter : undefined,
            }}
          />
        )}

        {/* レイヤー2: 手袋オーバーレイ (左手・右手の両方を1枚のレイヤーでカバーして素手のはみ出しを防止) */}
        {glovesSrc && (
          <Image
            key={`gloves-${glovesSrc}`}
            className={styles.overlaySprite}
            src={glovesSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{
              clipPath:
                "polygon(12% 28%, 48% 28%, 48% 55%, 12% 55%, 12% 70%, 88% 70%, 88% 54%, 68% 54%, 68% 70%, 48% 70%, 48% 55%)",
            }}
          />
        )}

        {/* レイヤー3: メガネオーバーレイ */}
        {glassesSrc && (
          <Image
            key={`glasses-${glassesSrc}`}
            className={styles.overlaySprite}
            src={glassesSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{ clipPath: "polygon(34% 21%, 73% 21%, 73% 36%, 34% 36%)" }}
          />
        )}

        {/* レイヤー4: 帽子オーバーレイ */}
        {hatSrc && (
          <Image
            key={`hat-${hatSrc}`}
            className={styles.overlaySprite}
            src={hatSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{ clipPath: hatClip }}
          />
        )}

        {/* ピンクのリボン装飾 */}
        {activeAccessories.hat === "hat_ribbon" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "8%", left: "48%", transform: "translate(-50%, -50%)", fontSize: "38px" }}
            aria-hidden="true"
          >
            🎀
          </div>
        )}

        {/* レイヤー5: アクセサリー (星ピン, イヤリング, ステッキ, くまポシェット) */}
        {accessoryType === "acc_pin_star" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "16%", left: "62%", transform: "translate(-50%, -50%)", fontSize: "24px" }}
            aria-hidden="true"
          >
            ⭐
          </div>
        )}
        {accessoryType === "acc_heart_earring" && (
          <>
            <div
              className={styles.accessoryLayer}
              style={{ top: "26%", left: "30%", transform: "translate(-50%, -50%)", fontSize: "18px" }}
              aria-hidden="true"
            >
              💖
            </div>
            <div
              className={styles.accessoryLayer}
              style={{ top: "26%", left: "70%", transform: "translate(-50%, -50%)", fontSize: "18px" }}
              aria-hidden="true"
            >
              💖
            </div>
          </>
        )}
        {accessoryType === "acc_wand" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "34%", left: "22%", transform: "translate(-50%, -50%) rotate(-20deg)", fontSize: "36px" }}
            aria-hidden="true"
          >
            🪄
          </div>
        )}
        {accessoryType === "acc_bag_bear" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "54%", left: "54%", transform: "translate(-50%, -50%)", fontSize: "34px" }}
            aria-hidden="true"
          >
            👜
          </div>
        )}
      </div>
    </div>
  );
}
