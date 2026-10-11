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
import {
  RibbonBow,
  StarHairPin,
  HeartEarring,
  MagicWand,
  BearPochette,
  AngelWings,
  HairstyleExtension,
} from "./CharacterAccessories";

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
  hair_color_black: "saturate(0.2) brightness(0.42) contrast(1.3)",
  hair_color_pink: "sepia(0.55) hue-rotate(295deg) saturate(2.6) brightness(1.1)",
  hair_color_gold: "sepia(0.85) hue-rotate(16deg) saturate(3.2) brightness(1.25)",
  hair_color_blue: "sepia(0.65) hue-rotate(175deg) saturate(2.8) brightness(1.1)",
};

// 前髪・こめかみ領域のみを精密にカバーし、襟元(y>=34.5%)・頭頂部リボン・顔の目口肌を完全に除外するポリゴン
const BANGS_HAIR_CLIP =
  "polygon(31.5% 21%, 35% 20.5%, 38% 17%, 44% 15.5%, 58% 15.5%, 65% 17%, 68.5% 21%, 71% 22%, 71% 34.5%, 66% 34.5%, 66% 25%, 40% 25%, 40% 34.5%, 31.5% 34.5%)";

// 手袋領域のみを厳密に切り出し（上端 y=0% の透明領域を経由することで服・袖・リュック・スカートを一切含めない）
const GLOVES_CLIP =
  "polygon(18% 0%, 18% 36.5%, 37.5% 36.5%, 37.5% 48%, 33% 50.5%, 18% 50.5%, 18% 0%, 74% 0%, 74% 58%, 89% 58%, 89% 67%, 74% 67%, 74% 0%)";

// 膝下の靴下・靴・ブーツ領域（素足の膝 y:74%..78%/84% を除外し、元の靴を100%差し替える）
const SHOE_REGION_CLIP =
  "polygon(24% 78%, 46.5% 78%, 46.5% 84%, 76% 84%, 76% 100%, 24% 100%)";

const SHOES_COLOR_FILTERS: Record<string, string> = {
  shoes_color_pink: "sepia(0.55) hue-rotate(295deg) saturate(2.6) brightness(1.1)",
  shoes_color_white: "brightness(2.4) contrast(0.9) saturate(0.1)",
  shoes_color_brown: "sepia(0.95) hue-rotate(-25deg) brightness(0.65) contrast(1.2)",
  shoes_color_blue: "hue-rotate(185deg) saturate(2.8) brightness(1.15)",
  shoes_color_gold: "hue-rotate(25deg) saturate(4) brightness(1.3)",
};

const SHOES_SPRITES: Record<string, string> = {
  shoes_sneaker: SPRITES.happy,
  shoes_boots: SPRITES.safari,
  shoes_pumps: SPRITES.school,
  shoes_magical: SPRITES.wizard,
  shoes_hero: SPRITES.hero,
};

const NATIVE_OUTFIT_SHOES: Record<string, string> = {
  clothes_casual: "shoes_sneaker",
  clothes_tshirt: "shoes_sneaker",
  clothes_hoodie: "shoes_sneaker",
  clothes_school: "shoes_pumps",
  clothes_safari: "shoes_boots",
  clothes_wizard: "shoes_magical",
  clothes_hero: "shoes_hero",
};

function buildBaseClipPath({
  clipTopHead,
  clipGloves,
  clipShoes,
}: {
  clipTopHead: boolean;
  clipGloves: boolean;
  clipShoes: boolean;
}): string | undefined {
  if (!clipTopHead && !clipGloves && !clipShoes) {
    return undefined;
  }

  const points: string[] = [];

  // 1. 上辺 (x: 0% -> 100%, y <= 35.5%)
  if (clipTopHead) {
    points.push(
      "0% 0%",
      "14% 0%",
      "14% 35.5%",
      "31.5% 35.5%",
      "31.5% 22%",
      "35% 20.5%",
      "38% 17.5%",
      "44% 15.5%",
      "58% 15.5%",
      "65% 17.5%",
      "68.5% 21%",
      "71% 22.5%",
      "71% 35.5%",
      "98% 35.5%",
      "98% 0%",
      "100% 0%",
    );
  } else {
    points.push("0% 0%", "100% 0%");
  }

  // 2. 右辺 (y: 0% -> 100%, 手袋着用時は右側の素手 y:58%..67% を切り抜く)
  if (clipGloves) {
    points.push(
      "100% 58%",
      "74% 58%",
      "74% 67%",
      "100% 67%",
      "100% 100%",
    );
  } else {
    points.push("100% 100%");
  }

  // 3. 下辺 (x: 100% -> 0%, 靴オーバーレイ時は元の靴 y:78%/84%..100% を切り抜く)
  if (clipShoes) {
    points.push(
      "76% 100%",
      "76% 84%",
      "46.5% 84%",
      "46.5% 78%",
      "24% 78%",
      "24% 100%",
      "0% 100%",
    );
  } else {
    points.push("0% 100%");
  }

  // 4. 左辺 (y: 100% -> 0%, 手袋着用時は左側の素手 y:36.5%..50.5% を切り抜く)
  if (clipGloves) {
    points.push(
      "0% 50.5%",
      "33% 50.5%",
      "37.5% 48%",
      "37.5% 36.5%",
      "0% 36.5%",
    );
  }

  return `polygon(${points.join(", ")})`;
}

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
  const currentClothes = activeAccessories.clothes ?? "clothes_casual";

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

  // 4. 髪型・髪色レイヤー (Hairstyle & Hair Color)
  const hairStyle = activeAccessories.hairstyle ?? "hair_bun";
  const hairColor = activeAccessories.hair_color ?? "hair_color_brown";
  const hairFilter = HAIR_COLOR_FILTERS[hairColor] ?? "none";

  // 5. 帽子レイヤー (Hat)
  const hatType = activeAccessories.hat ?? "hat_none";

  let hatSrc: string | null = null;
  let hatClip = "polygon(20% 0%, 82% 0%, 82% 23.5%, 68.5% 21%, 65% 17.5%, 38% 17.5%, 34% 20.5%, 20% 23.5%)";
  if (hatType === "hat_beret") {
    hatSrc = SPRITES.beret;
  } else if (hatType === "hat_safari") {
    hatSrc = SPRITES.safari;
    hatClip = "polygon(18% 0%, 84% 0%, 84% 24%, 68.5% 21%, 65% 17.5%, 38% 17.5%, 34% 20.5%, 18% 24%)";
  } else if (hatType === "hat_wizard") {
    hatSrc = SPRITES.wizard;
    hatClip =
      "polygon(14% 0%, 98% 0%, 98% 35%, 71% 35%, 71% 22.5%, 68.5% 21%, 65% 17.5%, 38% 17.5%, 35% 20.5%, 31.5% 22%, 31.5% 35%, 14% 35%)";
  } else if (hatType === "hat_crown") {
    hatSrc = SPRITES.hero;
    hatClip = "polygon(38% 4.5%, 63% 4.5%, 60% 13.5%, 41% 13.5%)";
  }

  // ベーススプライトに描き込まれた元のおだんご・ピンクリボン・内蔵帽子・サイドカールは常にクリップ除去し、
  // 選択中の髪型(HairstyleExtension)と選択中の帽子・アクセサリのみをクリーンに描画する
  const clipTopHead = true;

  const hatCoversBun =
    hatType === "hat_beret" || hatType === "hat_safari" || hatType === "hat_wizard";
  const showCleanBun = hairStyle === "hair_bun" && !hatCoversBun;

  // 6. 靴レイヤー (Shoes & Shoes Color)
  const shoesType = activeAccessories.shoes ?? "shoes_sneaker";
  const shoesColor = activeAccessories.shoes_color ?? "shoes_color_pink";
  const shoesBaseSrc = SHOES_SPRITES[shoesType] ?? SPRITES.happy;
  const shoesFilter =
    shoesColor === "shoes_color_pink"
      ? shoesType === "shoes_sneaker"
        ? "none"
        : SHOES_COLOR_FILTERS.shoes_color_pink
      : (SHOES_COLOR_FILTERS[shoesColor] ?? "none");

  const hasExplicitShoes = Boolean(activeAccessories.shoes || activeAccessories.shoes_color);
  const isNativeShoeUncolored =
    shoesType === (NATIVE_OUTFIT_SHOES[currentClothes] ?? "shoes_sneaker") &&
    shoesColor === "shoes_color_pink";
  const showShoesOverlay = hasExplicitShoes && !isNativeShoeUncolored;

  // ベーススプライトの複合クリップパス（元の髪型・元の帽子・元の素手・元の靴を完全に除去）
  const baseClipPath = buildBaseClipPath({
    clipTopHead,
    clipGloves: Boolean(glovesSrc),
    clipShoes: showShoesOverlay,
  });

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
            <AngelWings />
          </div>
        )}

        {/* レイヤー1: ベース全身衣装（元の靴・素手・頭頂部おだんご/帽子を必要に応じてクリップ除去） */}
        <Image
          key={`base-${baseSrc}`}
          className={styles.sprite}
          src={baseSrc}
          width={1024}
          height={1536}
          alt=""
          draggable={false}
          unoptimized
          style={baseClipPath ? { clipPath: baseClipPath } : undefined}
        />

        {/* レイヤー1c: 髪型エクステンション (ツインテール・ポニーテール・ボブ・ウェーブ・クリーンおだんご) */}
        <HairstyleExtension
          hairstyle={hairStyle}
          hairColor={hairColor}
          showCleanBun={showCleanBun}
        />

        {/* レイヤー1d: 地毛の前髪カラーオーバーレイ (襟やリボンを含めず前髪のみを着色) */}
        {hairFilter !== "none" && (
          <Image
            key={`hair-color-${hairColor}-${hairStyle}`}
            className={styles.hairColorOverlay}
            src={SPRITES.happy}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{
              clipPath: BANGS_HAIR_CLIP,
              filter: hairFilter,
            }}
          />
        )}

        {/* レイヤー1e: 靴＆靴色オーバーレイ (元の靴をクリップ除去した上に100%不透明で描画) */}
        {showShoesOverlay && (
          <Image
            key={`shoes-${shoesType}-${shoesColor}`}
            className={styles.shoesOverlay}
            src={shoesBaseSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{
              clipPath: SHOE_REGION_CLIP,
              filter: shoesFilter !== "none" ? shoesFilter : undefined,
            }}
          />
        )}

        {/* レイヤー2: 手袋オーバーレイ (元の素手をクリップ除去した上に両手領域のみを描画) */}
        {glovesSrc && (
          <Image
            key={`gloves-${glovesSrc}`}
            className={styles.glovesOverlay}
            src={glovesSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{
              clipPath: GLOVES_CLIP,
            }}
          />
        )}

        {/* レイヤー3: メガネオーバーレイ (目元ソフトマスク) */}
        {glassesSrc && (
          <Image
            key={`glasses-${glassesSrc}`}
            className={styles.glassesOverlay}
            src={glassesSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{ clipPath: "polygon(34% 21%, 73% 21%, 73% 34.5%, 34% 34.5%)" }}
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
            style={{ clipPath: hatClip, zIndex: 6 }}
          />
        )}

        {/* ピンクのサテンリボン装飾 */}
        {hatType === "hat_ribbon" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "8%", left: "50%", transform: "translate(-50%, -50%)" }}
            aria-hidden="true"
          >
            <RibbonBow />
          </div>
        )}

        {/* レイヤー5: ベクターアクセサリー */}
        {accessoryType === "acc_pin_star" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "15%", left: "64%", transform: "translate(-50%, -50%) rotate(15deg)" }}
            aria-hidden="true"
          >
            <StarHairPin />
          </div>
        )}
        {accessoryType === "acc_heart_earring" && (
          <>
            <div
              className={styles.accessoryLayer}
              style={{ top: "27%", left: "29%", transform: "translate(-50%, -50%)" }}
              aria-hidden="true"
            >
              <HeartEarring />
            </div>
            <div
              className={styles.accessoryLayer}
              style={{ top: "27%", left: "72%", transform: "translate(-50%, -50%) scaleX(-1)" }}
              aria-hidden="true"
            >
              <HeartEarring />
            </div>
          </>
        )}
        {accessoryType === "acc_wand" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "34%", left: "20%", transform: "translate(-50%, -50%) rotate(-18deg)" }}
            aria-hidden="true"
          >
            <MagicWand />
          </div>
        )}
        {accessoryType === "acc_bag_bear" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "54%", left: "53%", transform: "translate(-50%, -50%)" }}
            aria-hidden="true"
          >
            <BearPochette />
          </div>
        )}
      </div>
    </div>
  );
}
