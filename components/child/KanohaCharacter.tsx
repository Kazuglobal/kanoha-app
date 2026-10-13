"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./KanohaCharacter.module.css";
import {
  DEFAULT_EQUIPPED,
  getEquippedAccessories,
  type CharacterId,
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
  HAIR_COLOR_FILTERS,
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
  hatBeret: "/images/character/kanoha-hat-beret.png",
  hatSafari: "/images/character/kanoha-hat-safari.png",
  hatWizard: "/images/character/kanoha-hat-wizard.png",
  hatCrown: "/images/character/kanoha-hat-crown.png",
} as const;

// 手袋領域のみを厳密に切り出し（上端 y=0% の透明領域を経由し、両手首のもこもこボアカフスを100%保持しつつ茶髪の毛先や胴体を除外）
const GLOVES_CLIP =
  "polygon(18% 0%, 18% 36%, 32% 36%, 35% 39.5%, 41.5% 39.8%, 41.5% 49%, 33% 50.5%, 18% 50.5%, 18% 0%, 69.5% 0%, 69.5% 56%, 89.5% 56%, 89.5% 68%, 69.5% 68%, 69.5% 0%)";

// 膝下の靴下・靴・ブーツ領域（左足のふくらはぎを斜めに避けつつ元の靴を100%差し替える）
const SHOE_REGION_CLIP =
  "polygon(24% 79.5%, 35% 78%, 49.5% 82.5%, 49.5% 85.5%, 76% 85.5%, 76% 100%, 24% 100%)";

// 靴カラー変更時は白い靴下や素足の肌を変色させず、靴本体のみを着色するポリゴン
const SHOE_LEATHER_CLIP =
  "polygon(25% 81%, 35.5% 81%, 45.5% 85.5%, 45.5% 98%, 25% 98%, 25% 81%, 48.5% 88.5%, 65.5% 88%, 73% 99.5%, 48.5% 99.5%, 48.5% 88.5%)";

const SHOES_COLOR_FILTERS: Record<string, string> = {
  shoes_color_pink: "none",
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
  clipLeftHand,
  clipShoes,
}: {
  clipTopHead: boolean;
  clipGloves: boolean;
  clipLeftHand?: boolean;
  clipShoes: boolean;
}): string | undefined {
  if (!clipTopHead && !clipGloves && !clipLeftHand && !clipShoes) {
    return undefined;
  }

  const points: string[] = [];

  // 1. 上辺 (x: 0% -> 100%, 元の頭頂部おだんご・ピンクリボン・頭頂部の茶髪・左右に張り出す帽子のつばや毛束を端まで完全にクリップ除去)
  if (clipTopHead) {
    points.push(
      "0% 36.5%",
      "14% 36.5%",
      "34% 36.5%",
      "41.2% 39.0%",
      "41.2% 35.6%",
      "38% 35.2%",
      "38% 33.8%",
      "33.5% 33.5%",
      "32.5% 28%",
      "33.5% 23%",
      "36% 21.8%",
      "41% 21.2%",
      "61% 21.2%",
      "66.5% 22.8%",
      "68% 28%",
      "70.5% 29%",
      "70.5% 32.5%",
      "66.5% 33.8%",
      "66.5% 38.5%",
      "98% 38.5%",
      "100% 38.5%",
    );
  } else {
    points.push("0% 0%", "100% 0%");
  }

  // 2. 右辺 (y: 0% -> 100%, 手袋着用時は右側の素手 y:56%..68% を切り抜く)
  if (clipGloves) {
    points.push(
      "100% 56%",
      "69.5% 56%",
      "69.5% 68%",
      "100% 68%",
      "100% 100%",
    );
  } else {
    points.push("100% 100%");
  }

  // 3. 下辺 (x: 100% -> 0%, 靴オーバーレイ時は元の靴をふくらはぎに沿って切り抜く)
  if (clipShoes) {
    points.push(
      "76% 100%",
      "76% 85.5%",
      "49.5% 85.5%",
      "49.5% 82.5%",
      "35% 78%",
      "24% 79.5%",
      "24% 100%",
      "0% 100%",
    );
  } else {
    points.push("0% 100%");
  }

  // 4. 左辺 (y: 100% -> 0%, 手袋または魔法のステッキ着用時は左側の素手を切り抜く)
  if (clipGloves || clipLeftHand) {
    points.push(
      "0% 50.5%",
      "33% 50.5%",
      "41.5% 49%",
      "41.5% 39.8%",
      "35% 39.5%",
      "32% 36%",
      "0% 36%",
    );
  }

  return `polygon(${points.join(", ")})`;
}

type OutfitVariant = "base" | "school" | "safari" | "hoodie" | "wizard" | "hero";

const NEW_CHARACTER_SPRITES: Record<Exclude<CharacterId, "char_kanoha">, Record<OutfitVariant, string>> = {
  char_fuwari: {
    base: "/images/character/chars/fuwari-base.png",
    school: "/images/character/chars/fuwari-school.png",
    safari: "/images/character/chars/fuwari-safari.png",
    hoodie: "/images/character/chars/fuwari-hoodie.png",
    wizard: "/images/character/chars/fuwari-wizard.png",
    hero: "/images/character/chars/fuwari-hero.png",
  },
  char_hinata: {
    base: "/images/character/chars/hinata-base.png",
    school: "/images/character/chars/hinata-school.png",
    safari: "/images/character/chars/hinata-safari.png",
    hoodie: "/images/character/chars/hinata-hoodie.png",
    wizard: "/images/character/chars/hinata-wizard.png",
    hero: "/images/character/chars/hinata-hero.png",
  },
  char_ren: {
    base: "/images/character/chars/ren-base.png",
    school: "/images/character/chars/ren-school.png",
    safari: "/images/character/chars/ren-safari.png",
    hoodie: "/images/character/chars/ren-hoodie.png",
    wizard: "/images/character/chars/ren-wizard.png",
    hero: "/images/character/chars/ren-hero.png",
  },
  char_riku: {
    base: "/images/character/chars/riku-base.png",
    school: "/images/character/chars/riku-school.png",
    safari: "/images/character/chars/riku-safari.png",
    hoodie: "/images/character/chars/riku-hoodie.png",
    wizard: "/images/character/chars/riku-wizard.png",
    hero: "/images/character/chars/riku-hero.png",
  },
  char_mia: {
    base: "/images/character/chars/mia-base.png",
    school: "/images/character/chars/mia-school.png",
    safari: "/images/character/chars/mia-safari.png",
    hoodie: "/images/character/chars/mia-hoodie.png",
    wizard: "/images/character/chars/mia-wizard.png",
    hero: "/images/character/chars/mia-hero.png",
  },
};

export const CHARACTER_DISPLAY_NAMES: Record<CharacterId, string> = {
  char_kanoha: "かのはちゃん",
  char_fuwari: "ふわりちゃん",
  char_hinata: "ひなたちゃん",
  char_ren: "レンくん",
  char_riku: "リクくん",
  char_mia: "ミアちゃん",
};

interface CharacterAnchorMeta {
  ribbonTop: string;
  ribbonLeft: string;
  shoesClip: string;
  hasBakedWingsInHero: boolean;
  pinTransform: string;
  earringTransform: string;
  wandTransform: string;
  bagTransform: string;
  wingsTransform: string;
}

const CHARACTER_ANCHORS: Record<Exclude<CharacterId, "char_kanoha">, CharacterAnchorMeta> = {
  char_fuwari: {
    ribbonTop: "6%",
    ribbonLeft: "49%",
    shoesClip: "polygon(26% 74%, 42% 74%, 42% 88%, 58% 85%, 58% 99.5%, 26% 99.5%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(0%, -5%)",
    earringTransform: "translate(-1%, -7%) scale(0.88)",
    wandTransform: "translate(-2%, -10%) scale(0.9)",
    bagTransform: "translate(-2%, -10%) scale(0.9)",
    wingsTransform: "translate(0%, -8%) scale(0.95)",
  },
  char_hinata: {
    ribbonTop: "5%",
    ribbonLeft: "50%",
    shoesClip: "polygon(36% 81%, 69% 81%, 69% 99.5%, 36% 99.5%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(0%, -4%)",
    earringTransform: "translate(-2%, -5%) scale(0.88)",
    wandTransform: "translate(-2%, -6%) scale(0.9)",
    bagTransform: "translate(2%, -8%) scale(0.9)",
    wingsTransform: "translate(0%, -6%) scale(0.95)",
  },
  char_ren: {
    ribbonTop: "4%",
    ribbonLeft: "46%",
    shoesClip: "polygon(28% 87%, 70% 87%, 70% 99.8%, 28% 99.8%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(-6%, -9%) scale(0.85)",
    earringTransform: "translate(-3%, -16%) scale(0.75)",
    wandTransform: "translate(2%, -8%) scale(0.88)",
    bagTransform: "translate(2%, -10%) scale(0.88)",
    wingsTransform: "translate(-1%, -12%) scale(0.95)",
  },
  char_riku: {
    ribbonTop: "5%",
    ribbonLeft: "55%",
    shoesClip: "polygon(24% 68%, 39% 68%, 39% 84%, 67% 82%, 67% 99.5%, 24% 99.5%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(1%, -8%) scale(0.85)",
    earringTransform: "translate(4%, -10%) scale(0.82)",
    wandTransform: "translate(-2%, -10%) scale(0.88)",
    bagTransform: "translate(-1%, -12%) scale(0.88)",
    wingsTransform: "translate(2%, -10%) scale(0.95)",
  },
  char_mia: {
    ribbonTop: "4%",
    ribbonLeft: "48%",
    shoesClip: "polygon(38% 85%, 62% 85%, 62% 99.5%, 38% 99.5%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(-3%, -8%) scale(0.85)",
    earringTransform: "translate(-2%, -13%) scale(0.78)",
    wandTransform: "translate(4%, -10%) scale(0.88)",
    bagTransform: "translate(2%, -11%) scale(0.88)",
    wingsTransform: "translate(-1%, -11%) scale(0.95)",
  },
};

function resolveNewCharacterVariant(
  accessories: EquippedAccessories,
  previewCategory?: AccessoryCategory,
): OutfitVariant {
  // 1. 服（clothes）が明示的に選ばれている場合は常に服の選択を最優先（前の服やアクセサリが残るのを完全に防止）
  switch (accessories.clothes) {
    case "clothes_school":
      return "school";
    case "clothes_safari":
      return "safari";
    case "clothes_hoodie":
      return "hoodie";
    case "clothes_wizard":
      return "wizard";
    case "clothes_hero":
      return "hero";
    case "clothes_tshirt":
    case "clothes_casual":
      return "base";
    default:
      break;
  }

  // 2. モーダルでタブプレビュー中の場合
  if (previewCategory === "hat") {
    if (accessories.hat === "hat_safari") return "safari";
    if (accessories.hat === "hat_beret") return "hoodie";
    if (accessories.hat === "hat_wizard") return "wizard";
    if (accessories.hat === "hat_crown") return "hero";
  } else if (previewCategory === "shoes") {
    if (accessories.shoes === "shoes_pumps") return "school";
    if (accessories.shoes === "shoes_boots") return "safari";
    if (accessories.shoes === "shoes_magical") return "wizard";
    if (accessories.shoes === "shoes_hero") return "hero";
    if (accessories.shoes === "shoes_sneaker") return "base";
  } else if (previewCategory === "gloves") {
    if (accessories.gloves === "gloves_mitten") return "hoodie";
    if (accessories.gloves === "gloves_gold") return "hero";
  }

  return "base";
}

export function getKanohaSprite(
  mood: Mood,
  accessories: EquippedAccessories,
  previewCategory?: AccessoryCategory,
): string {
  const charId = (accessories.character ?? "char_kanoha") as CharacterId;
  if (charId !== "char_kanoha" && charId in NEW_CHARACTER_SPRITES) {
    const variant = resolveNewCharacterVariant(accessories, previewCategory);
    return NEW_CHARACTER_SPRITES[charId][variant];
  }

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

export function KanohaCharacter({ mood = "happy", accessories, previewCategory, onClick }: KanohaCharacterProps) {
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
  const charId = ((activeAccessories.character ?? "char_kanoha") in CHARACTER_DISPLAY_NAMES
    ? (activeAccessories.character ?? "char_kanoha")
    : "char_kanoha") as CharacterId;
  const displayName = CHARACTER_DISPLAY_NAMES[charId];
  const moodLabel = mood === "think" ? "かんがえちゅう" : mood === "celebrate" ? "よろこび" : "にっこり";

  // 新規5キャラクター選択時は、各キャラクター専用の3D生成フルボディスプライト・ピクセル精密髪色レイヤー・調整済みアクセサリを描画
  if (charId !== "char_kanoha") {
    const variant = resolveNewCharacterVariant(activeAccessories, previewCategory);
    const charSrc = NEW_CHARACTER_SPRITES[charId][variant];
    const hairSrc = charSrc.replace(/\.png$/, "-hair.png");
    const anchor = CHARACTER_ANCHORS[charId];
    const hairColor = activeAccessories.hair_color ?? "hair_color_brown";
    const hairFilter = HAIR_COLOR_FILTERS[hairColor] ?? "none";
    const shoesColor = activeAccessories.shoes_color ?? "shoes_color_pink";
    const shoesFilter = SHOES_COLOR_FILTERS[shoesColor] ?? "none";
    const hatType = activeAccessories.hat ?? "hat_none";
    const accessoryType = activeAccessories.accessory ?? "acc_none";
    const showWings =
      accessoryType === "acc_wings" && !(variant === "hero" && anchor.hasBakedWingsInHero);

    return (
      <div
        className={`${styles.stage} ${mood === "celebrate" ? styles.celebrate : ""}`}
        role={onClick ? "button" : "img"}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${displayName}（${moodLabel}）`}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onClick && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        <div className={styles.characterContainer}>
          {showWings && (
            <AngelWings style={{ transform: anchor.wingsTransform, transformOrigin: "50% 40%" }} />
          )}

          <Image
            key={`char-${charId}-${charSrc}`}
            className={styles.sprite}
            src={charSrc}
            width={768}
            height={1024}
            alt=""
            draggable={false}
            unoptimized
          />

          {hairFilter !== "none" && (
            <Image
              key={`hair-${charId}-${variant}-${hairColor}`}
              className={styles.shoesOverlay}
              src={hairSrc}
              width={768}
              height={1024}
              alt=""
              draggable={false}
              unoptimized
              style={{
                filter: hairFilter,
                pointerEvents: "none",
              }}
            />
          )}

          {shoesFilter !== "none" && (
            <svg
              viewBox="0 0 768 1024"
              className={styles.shoesOverlay}
              style={{ pointerEvents: "none" }}
              aria-hidden="true"
            >
              <image
                href={charSrc}
                width="768"
                height="1024"
                style={{
                  clipPath: anchor.shoesClip,
                  filter: shoesFilter,
                }}
              />
            </svg>
          )}

          {hatType === "hat_ribbon" && (
            <div
              className={styles.accessoryLayer}
              style={{
                top: anchor.ribbonTop,
                left: anchor.ribbonLeft,
                transform: "translate(-50%, -50%)",
              }}
              aria-hidden="true"
            >
              <RibbonBow />
            </div>
          )}

          {accessoryType === "acc_pin_star" && (
            <StarHairPin style={{ transform: anchor.pinTransform, transformOrigin: "60% 20%" }} />
          )}
          {accessoryType === "acc_heart_earring" && (
            <HeartEarring style={{ transform: anchor.earringTransform, transformOrigin: "50% 30%" }} />
          )}
          {accessoryType === "acc_wand" && variant !== "wizard" && (
            <MagicWand style={{ transform: anchor.wandTransform, transformOrigin: "25% 40%" }} />
          )}
          {accessoryType === "acc_bag_bear" && variant !== "hoodie" && (
            <BearPochette style={{ transform: anchor.bagTransform, transformOrigin: "45% 60%" }} />
          )}
        </div>
      </div>
    );
  }

  // 1. ベース衣装 (かのはちゃん)
  const baseSrc = getKanohaSprite(mood, activeAccessories, previewCategory);
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

  // 5. 帽子レイヤー (Hat: 茶髪おだんごやピンクリボンの残骸を除去したクリーンな単体帽子スプライトを使用)
  const hatType = activeAccessories.hat ?? "hat_none";

  let hatSrc: string | null = null;
  if (hatType === "hat_beret") {
    hatSrc = SPRITES.hatBeret;
  } else if (hatType === "hat_safari") {
    hatSrc = SPRITES.hatSafari;
  } else if (hatType === "hat_wizard") {
    hatSrc = SPRITES.hatWizard;
  } else if (hatType === "hat_crown") {
    hatSrc = SPRITES.hatCrown;
  }

  // ベーススプライトに描き込まれた元のおだんご・ピンクリボン・内蔵帽子・サイドカールは常にクリップ除去し、
  // 選択中の3D髪型(HairstyleExtension)と選択中の帽子・アクセサリのみをクリーンに描画する
  const clipTopHead = true;

  const hatCoversBun =
    hatType === "hat_beret" || hatType === "hat_safari" || hatType === "hat_wizard";
  const showCleanBun = hairStyle === "hair_bun" && !hatCoversBun;

  // 6. 靴レイヤー (Shoes & Shoes Color)
  const shoesType = activeAccessories.shoes ?? "shoes_sneaker";
  const shoesColor = activeAccessories.shoes_color ?? "shoes_color_pink";
  const shoesBaseSrc = SHOES_SPRITES[shoesType] ?? SPRITES.happy;
  const shoesFilter = SHOES_COLOR_FILTERS[shoesColor] ?? "none";

  const hasExplicitShoes = Boolean(activeAccessories.shoes || activeAccessories.shoes_color);
  const isNativeShoeUncolored =
    shoesType === (NATIVE_OUTFIT_SHOES[currentClothes] ?? "shoes_sneaker") &&
    shoesColor === "shoes_color_pink";
  const showShoesOverlay = hasExplicitShoes && !isNativeShoeUncolored;

  // 7. アクセサリー (Accessory)
  const accessoryType = activeAccessories.accessory ?? "acc_none";

  // ベーススプライトの複合クリップパス（元の髪型・元の帽子・元の素手・元の靴を完全に除去）
  const baseClipPath = buildBaseClipPath({
    clipTopHead,
    clipGloves: Boolean(glovesSrc),
    clipLeftHand: accessoryType === "acc_wand",
    clipShoes: showShoesOverlay,
  });

  return (
    <div
      className={`${styles.stage} ${mood === "celebrate" ? styles.celebrate : ""}`}
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${displayName}（${moodLabel}）`}
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
        {accessoryType === "acc_wings" && <AngelWings />}

        {/* レイヤー0b: 3D髪型 背面レイヤー（肩・襟元・腕の後ろに自然に回り込む髪） */}
        <HairstyleExtension
          hairstyle={hairStyle}
          hairColor={hairColor}
          showCleanBun={showCleanBun}
          layer="back"
        />

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

        {/* レイヤー1c: 3D髪型 前面レイヤー（頭頂部・前髪・顔周りのサイド髪） */}
        <HairstyleExtension
          hairstyle={hairStyle}
          hairColor={hairColor}
          showCleanBun={showCleanBun}
          layer="front"
        />

        {/* レイヤー1e: 靴＆靴色オーバーレイ (元の靴をクリップ除去した上に100%不透明で描画し、色変更時は靴本体のみ着色) */}
        {showShoesOverlay && (
          <>
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
              }}
            />
            {shoesFilter !== "none" && (
              <svg
                viewBox="0 0 1024 1536"
                className={styles.shoesOverlay}
                style={{ pointerEvents: "none" }}
                aria-hidden="true"
              >
                <image
                  href={shoesBaseSrc}
                  width="1024"
                  height="1536"
                  style={{
                    clipPath: SHOE_LEATHER_CLIP,
                    filter: shoesFilter,
                  }}
                />
              </svg>
            )}
          </>
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
            style={{ zIndex: 6 }}
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

        {/* レイヤー5: 3D生成アクセサリー */}
        {accessoryType === "acc_pin_star" && <StarHairPin />}
        {accessoryType === "acc_heart_earring" && <HeartEarring />}
        {accessoryType === "acc_wand" && <MagicWand />}
        {accessoryType === "acc_bag_bear" && <BearPochette />}
      </div>
    </div>
  );
}
