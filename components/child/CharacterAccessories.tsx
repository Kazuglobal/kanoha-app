"use client";

import React from "react";
import type { CharacterId } from "@/lib/rewards/characterGrowthStore";

/**
 * キャラクターの3Dイラスト画風に完全調和する高品位な着せ替え・髪型・アクセサリーコンポーネント。
 * さゆきちゃん（kanoha-ref）および5人の新キャラクター（ルナ・コハル・ノア・リーフ・ピコ）の
 * それぞれの骨格・ポーズ・頭身に合わせて精密にフィッティングします。
 */

export const HAIRSTYLE_SPRITES: Record<string, string> = {
  hair_bun: "/images/character/kanoha-ref-hair-bun.png",
  hair_bob: "/images/character/kanoha-ref-hair-bob.png",
  hair_twintail: "/images/character/kanoha-ref-hair-twintail.png",
  hair_pony: "/images/character/kanoha-ref-hair-pony.png",
  hair_long_wave: "/images/character/kanoha-ref-hair-long-wave.png",
};

export const TRIMMED_HAIR_SPRITES: Record<string, string> = {
  hair_bun: "/images/character/item-hair-bun.png",
  hair_bob: "/images/character/item-hair-bob.png",
  hair_twintail: "/images/character/item-hair-twintail.png",
  hair_pony: "/images/character/item-hair-pony.png",
  hair_long_wave: "/images/character/item-hair-long-wave.png",
};

export const ACCESSORY_SPRITES = {
  pinStar: "/images/character/kanoha-ref-acc-pin-star.png",
  heartEarring: "/images/character/kanoha-ref-acc-heart-earring.png",
  wand: "/images/character/kanoha-ref-acc-wand.png",
  bagBear: "/images/character/kanoha-ref-acc-bag-bear.png",
  wings: "/images/character/kanoha-ref-acc-wings.png",
} as const;

export const TRIMMED_ITEM_SPRITES = {
  hatBeret: "/images/character/item-hat-beret.png",
  hatSafari: "/images/character/item-hat-safari.png",
  hatWizard: "/images/character/item-hat-wizard.png",
  hatCrown: "/images/character/item-hat-crown.png",
  glovesMitten: "/images/character/item-gloves-mitten.png",
  wand: "/images/character/item-acc-wand-trimmed.png",
  bagBear: "/images/character/item-acc-bag-bear-trimmed.png",
  wings: "/images/character/item-acc-wings-trimmed.png",
} as const;

export const HAIR_COLOR_FILTERS: Record<string, string> = {
  hair_color_brown: "none",
  hair_color_black: "saturate(0.2) brightness(0.42) contrast(1.3)",
  hair_color_pink: "sepia(0.55) hue-rotate(295deg) saturate(2.6) brightness(1.1)",
  hair_color_gold: "sepia(0.85) hue-rotate(16deg) saturate(3.2) brightness(1.25)",
  hair_color_blue: "sepia(0.65) hue-rotate(175deg) saturate(2.8) brightness(1.1)",
};

/** キャラごとの地毛色に合わせた3Dエクステ基本フィルタ（hair_color_brown=デフォルト時） */
export const CHAR_NATIVE_HAIR_FILTER: Record<CharacterId, string> = {
  char_sayuki: "none",
  char_luna: "sepia(0.75) hue-rotate(14deg) saturate(2.4) brightness(1.28)",
  char_koharu: "sepia(0.85) hue-rotate(-8deg) saturate(2.8) brightness(1.05)",
  char_noa: "saturate(0.35) brightness(0.48) contrast(1.25)",
  char_leaf: "sepia(0.65) hue-rotate(68deg) saturate(2.1) brightness(1.15)",
  char_pico: "sepia(0.9) hue-rotate(5deg) saturate(3.5) brightness(1.2)",
};

export interface CharacterAnchors {
  key: string;
  label: string;
  hat: { top: string; left: string; width: string; rotate: number };
  crown: { top: string; left: string; width: string; rotate: number };
  glasses: { top: string; left: string; width: string; rotate: number };
  pin: { top: string; left: string; rotate: number };
  earLeft: { top: string; left: string };
  earRight: { top: string; left: string };
  handLeft: { top: string; left: string; size: string; rotate: number };
  handRight: { top: string; left: string; size: string; rotate: number };
  wand: { top: string; left: string; width: string; rotate: number };
  bag: { top: string; left: string; width: string; rotate: number };
  wings: { top: string; left: string; width: string };
  hairExt: { top: string; left: string; width: string; rotate: number };
  shoeLeft: { top: string; left: string; rotate: number };
  shoeRight: { top: string; left: string; rotate: number };
}

export const CHARACTER_ANCHORS: Record<Exclude<CharacterId, "char_sayuki">, CharacterAnchors> = {
  char_luna: {
    key: "luna",
    label: "ルナ",
    hat: { top: "14.5%", left: "50%", width: "44%", rotate: -7 },
    crown: { top: "9.5%", left: "49%", width: "22%", rotate: -7 },
    glasses: { top: "29.2%", left: "51.5%", width: "33%", rotate: -10 },
    pin: { top: "20%", left: "60%", rotate: 14 },
    earLeft: { top: "32.5%", left: "36%" },
    earRight: { top: "28.5%", left: "65%" },
    handLeft: { top: "38%", left: "42.5%", size: "13%", rotate: -15 },
    handRight: { top: "34.5%", left: "68.5%", size: "13%", rotate: 18 },
    wand: { top: "31%", left: "33%", width: "25%", rotate: -18 },
    bag: { top: "53%", left: "48%", width: "23%", rotate: -4 },
    wings: { top: "44%", left: "52%", width: "78%" },
    hairExt: { top: "26%", left: "50%", width: "68%", rotate: -6 },
    shoeLeft: { top: "68.5%", left: "28.5%", rotate: -25 },
    shoeRight: { top: "89.5%", left: "48.5%", rotate: 5 },
  },
  char_koharu: {
    key: "koharu",
    label: "コハル",
    hat: { top: "14.5%", left: "44.5%", width: "44%", rotate: -12 },
    crown: { top: "9.5%", left: "43.5%", width: "22%", rotate: -12 },
    glasses: { top: "25.2%", left: "47.2%", width: "31%", rotate: -10 },
    pin: { top: "18%", left: "55%", rotate: 12 },
    earLeft: { top: "29.8%", left: "34.5%" },
    earRight: { top: "25.0%", left: "61.0%" },
    handLeft: { top: "58.5%", left: "20.0%", size: "13%", rotate: 35 },
    handRight: { top: "53.0%", left: "79.5%", size: "13%", rotate: -35 },
    wand: { top: "50%", left: "14%", width: "25%", rotate: -25 },
    bag: { top: "53%", left: "49%", width: "23%", rotate: 2 },
    wings: { top: "44%", left: "49%", width: "78%" },
    hairExt: { top: "25%", left: "47%", width: "66%", rotate: -8 },
    shoeLeft: { top: "89.5%", left: "43.0%", rotate: 4 },
    shoeRight: { top: "80.0%", left: "67.0%", rotate: -22 },
  },
  char_noa: {
    key: "noa",
    label: "ノア",
    hat: { top: "14.5%", left: "47.5%", width: "43%", rotate: -6 },
    crown: { top: "9.5%", left: "47%", width: "21%", rotate: -6 },
    glasses: { top: "25.2%", left: "46.8%", width: "32%", rotate: -11 },
    pin: { top: "17.5%", left: "56%", rotate: 12 },
    earLeft: { top: "29.5%", left: "33.5%" },
    earRight: { top: "24.5%", left: "59.5%" },
    handLeft: { top: "46.5%", left: "45.5%", size: "11.5%", rotate: -10 },
    handRight: { top: "47.0%", left: "56.5%", size: "11.5%", rotate: 12 },
    wand: { top: "40%", left: "33%", width: "24%", rotate: -16 },
    bag: { top: "54%", left: "45%", width: "22%", rotate: -3 },
    wings: { top: "44%", left: "49%", width: "76%" },
    hairExt: { top: "25%", left: "48%", width: "66%", rotate: -6 },
    shoeLeft: { top: "90.0%", left: "47.5%", rotate: 2 },
    shoeRight: { top: "87.0%", left: "57.5%", rotate: -4 },
  },
  char_leaf: {
    key: "leaf",
    label: "リーフ",
    hat: { top: "15.0%", left: "50.5%", width: "44%", rotate: -5 },
    crown: { top: "10.0%", left: "50%", width: "22%", rotate: -5 },
    glasses: { top: "28.6%", left: "51.0%", width: "32%", rotate: -8 },
    pin: { top: "19.5%", left: "60%", rotate: 14 },
    earLeft: { top: "33.0%", left: "30.5%" },
    earRight: { top: "27.5%", left: "70.0%" },
    handLeft: { top: "48.5%", left: "23.0%", size: "13.5%", rotate: 25 },
    handRight: { top: "54.0%", left: "78.5%", size: "13.5%", rotate: -25 },
    wand: { top: "40%", left: "16%", width: "25%", rotate: -20 },
    bag: { top: "53%", left: "46%", width: "22%", rotate: 3 },
    wings: { top: "45%", left: "52%", width: "78%" },
    hairExt: { top: "27%", left: "51%", width: "68%", rotate: -5 },
    shoeLeft: { top: "81.0%", left: "38.5%", rotate: 15 },
    shoeRight: { top: "89.5%", left: "53.5%", rotate: -2 },
  },
  char_pico: {
    key: "pico",
    label: "ピコ",
    hat: { top: "17.5%", left: "55.0%", width: "48%", rotate: 8 },
    crown: { top: "12.5%", left: "55.5%", width: "24%", rotate: 8 },
    glasses: { top: "32.5%", left: "55.5%", width: "38%", rotate: 8 },
    pin: { top: "21.5%", left: "66%", rotate: 20 },
    earLeft: { top: "29.5%", left: "25.5%" },
    earRight: { top: "38.5%", left: "80.5%" },
    handLeft: { top: "36.5%", left: "18.0%", size: "16%", rotate: -25 },
    handRight: { top: "60.5%", left: "88.0%", size: "15%", rotate: -35 },
    wand: { top: "28%", left: "12%", width: "26%", rotate: -24 },
    bag: { top: "57%", left: "52%", width: "23%", rotate: -4 },
    wings: { top: "50%", left: "55%", width: "82%" },
    hairExt: { top: "30%", left: "55%", width: "74%", rotate: 8 },
    shoeLeft: { top: "78.0%", left: "32.5%", rotate: 12 },
    shoeRight: { top: "88.5%", left: "61.5%", rotate: -4 },
  },
};

const FULL_STAGE_SVG_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};

const FRONT_HAIR_CLIP =
  "polygon(0% 0%, 100% 0%, 100% 39.5%, 63.5% 39.5%, 63.5% 34.2%, 41.2% 34.2%, 41.2% 39.5%, 0% 39.5%)";

export function RibbonBow({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      style={{
        width: "90px",
        height: "68px",
        filter: "drop-shadow(0 4px 8px rgba(225, 29, 72, 0.35))",
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ribbonMain" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="40%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id="ribbonHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe4e6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fda4af" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ribbonKnot" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
      </defs>
      <path d="M80 50 C55 15, 10 20, 15 52 C18 70, 50 65, 80 54 Z" fill="url(#ribbonMain)" />
      <path d="M75 48 C55 24, 25 25, 22 45 C35 38, 58 40, 75 48 Z" fill="url(#ribbonHighlight)" />
      <path d="M80 50 C105 15, 150 20, 145 52 C142 70, 110 65, 80 54 Z" fill="url(#ribbonMain)" />
      <path d="M85 48 C105 24, 135 25, 138 45 C125 38, 102 40, 85 48 Z" fill="url(#ribbonHighlight)" />
      <path d="M72 56 C60 75, 45 95, 38 112 C48 108, 62 104, 75 106 C74 88, 73 70, 72 56 Z" fill="url(#ribbonMain)" />
      <path d="M88 56 C100 75, 115 95, 122 112 C112 108, 98 104, 85 106 C86 88, 87 70, 88 56 Z" fill="url(#ribbonMain)" />
      <ellipse cx="80" cy="52" rx="14" ry="12" fill="url(#ribbonKnot)" />
      <ellipse cx="78" cy="48" rx="8" ry="5" fill="#ffe4e6" opacity="0.6" />
    </svg>
  );
}

/** どのキャラクターの目元にも自然に馴染む3D調めがねコンポーネント */
export function NaturalGlassesOverlay({
  type,
  anchor,
}: {
  type: "glasses_round" | "glasses_star";
  anchor: { top: string; left: string; width: string; rotate: number };
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: anchor.top,
        left: anchor.left,
        width: anchor.width,
        transform: `translate(-50%, -50%) rotate(${anchor.rotate}deg)`,
        pointerEvents: "none",
        zIndex: 6,
        filter: "drop-shadow(0 4px 6px rgba(15, 23, 42, 0.28))",
      }}
      aria-hidden="true"
    >
      {type === "glasses_round" ? (
        <svg viewBox="0 0 320 130" style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <linearGradient id="roundFrame" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="40%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            <linearGradient id="lensGlint" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="45%" stopColor="#e0f2fe" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* つる（左右） */}
          <path d="M8 58 L28 62" stroke="url(#roundFrame)" strokeWidth="6" strokeLinecap="round" />
          <path d="M292 62 L312 58" stroke="url(#roundFrame)" strokeWidth="6" strokeLinecap="round" />
          {/* ブリッジ */}
          <path d="M134 62 Q160 46 186 62" stroke="url(#roundFrame)" strokeWidth="7" fill="none" strokeLinecap="round" />
          {/* 左レンズ＆フレーム */}
          <circle cx="82" cy="65" r="52" fill="url(#lensGlint)" stroke="url(#roundFrame)" strokeWidth="8.5" />
          <path d="M52 36 Q70 26 95 34" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.7" />
          {/* 右レンズ＆フレーム */}
          <circle cx="238" cy="65" r="52" fill="url(#lensGlint)" stroke="url(#roundFrame)" strokeWidth="8.5" />
          <path d="M208 36 Q226 26 251 34" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
      ) : (
        <svg viewBox="0 0 340 150" style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <linearGradient id="starFrameGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="starPinkLens" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.58" />
              <stop offset="60%" stopColor="#ec4899" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <path d="M6 72 L32 76" stroke="url(#starFrameGold)" strokeWidth="6.5" strokeLinecap="round" />
          <path d="M308 76 L334 72" stroke="url(#starFrameGold)" strokeWidth="6.5" strokeLinecap="round" />
          <path d="M142 74 Q170 58 198 74" stroke="url(#starFrameGold)" strokeWidth="7.5" fill="none" strokeLinecap="round" />
          {/* 左スターレンズ */}
          <polygon
            points="86,10 104,48 146,52 114,80 124,122 86,100 48,122 58,80 26,52 68,48"
            fill="url(#starPinkLens)"
            stroke="url(#starFrameGold)"
            strokeWidth="7.5"
            strokeLinejoin="round"
          />
          {/* 右スターレンズ */}
          <polygon
            points="254,10 272,48 314,52 282,80 292,122 254,100 216,122 226,80 194,52 236,48"
            fill="url(#starPinkLens)"
            stroke="url(#starFrameGold)"
            strokeWidth="7.5"
            strokeLinejoin="round"
          />
          <circle cx="72" cy="56" r="6" fill="#ffffff" opacity="0.75" />
          <circle cx="240" cy="56" r="6" fill="#ffffff" opacity="0.75" />
        </svg>
      )}
    </div>
  );
}

/** 靴タイプ変更時に両足に自然な3D装飾（ブーツカフス・リボン・魔法の羽星・勇者クレスト）を付与 */
export function NaturalShoeStyleBadge({
  shoesType,
  leftShoe,
  rightShoe,
}: {
  shoesType: string;
  leftShoe: { top: string; left: string; rotate: number };
  rightShoe: { top: string; left: string; rotate: number };
}) {
  if (!shoesType || shoesType === "shoes_sneaker") return null;

  const renderBadge = () => {
    if (shoesType === "shoes_pumps") {
      return (
        <svg viewBox="0 0 80 60" style={{ width: "44px", height: "34px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}>
          <path d="M40 30 C22 10, 6 16, 10 34 C13 45, 28 40, 40 32 Z" fill="#f43f5e" stroke="#fff" strokeWidth="2" />
          <path d="M40 30 C58 10, 74 16, 70 34 C67 45, 52 40, 40 32 Z" fill="#f43f5e" stroke="#fff" strokeWidth="2" />
          <circle cx="40" cy="31" r="7" fill="#fda4af" stroke="#be123c" strokeWidth="2" />
        </svg>
      );
    }
    if (shoesType === "shoes_magical") {
      return (
        <svg viewBox="0 0 90 70" style={{ width: "48px", height: "38px", filter: "drop-shadow(0 2px 6px rgba(168,85,247,0.45))" }}>
          <path d="M18 42 C6 24, 18 10, 38 26 Z" fill="#fef08a" stroke="#a855f7" strokeWidth="2" />
          <path d="M72 42 C84 24, 72 10, 52 26 Z" fill="#fef08a" stroke="#a855f7" strokeWidth="2" />
          <polygon points="45,12 51,26 66,28 54,38 58,52 45,44 32,52 36,38 24,28 39,26" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
        </svg>
      );
    }
    if (shoesType === "shoes_hero") {
      return (
        <svg viewBox="0 0 90 70" style={{ width: "50px", height: "40px", filter: "drop-shadow(0 2px 6px rgba(217,119,6,0.5))" }}>
          <path d="M12 36 L36 22 L36 46 Z" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
          <path d="M78 36 L54 22 L54 46 Z" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
          <circle cx="45" cy="35" r="14" fill="#fbbf24" stroke="#fff" strokeWidth="2.5" />
          <path d="M45 27 C40 21, 32 25, 35 33 C38 39, 45 44, 45 44 C45 44, 52 39, 55 33 C58 25, 50 21, 45 27 Z" fill="#f43f5e" />
        </svg>
      );
    }
    // shoes_boots: fluffy explorer cuff
    return (
      <svg viewBox="0 0 90 50" style={{ width: "46px", height: "26px", filter: "drop-shadow(0 2px 4px rgba(120,53,15,0.35))" }}>
        <rect x="10" y="12" width="70" height="24" rx="12" fill="#fef3c7" stroke="#b45309" strokeWidth="3" />
      </svg>
    );
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: leftShoe.top,
          left: leftShoe.left,
          transform: `translate(-50%, -65%) rotate(${leftShoe.rotate}deg)`,
          pointerEvents: "none",
          zIndex: 5,
        }}
        aria-hidden="true"
      >
        {renderBadge()}
      </div>
      <div
        style={{
          position: "absolute",
          top: rightShoe.top,
          left: rightShoe.left,
          transform: `translate(-50%, -65%) rotate(${rightShoe.rotate}deg)`,
          pointerEvents: "none",
          zIndex: 5,
        }}
        aria-hidden="true"
      >
        {renderBadge()}
      </div>
    </>
  );
}

export function StarHairPin({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1024 1536"
      className={className}
      style={{ ...FULL_STAGE_SVG_STYLE, zIndex: 7, ...style }}
      aria-hidden="true"
    >
      <image href={ACCESSORY_SPRITES.pinStar} width="1024" height="1536" />
    </svg>
  );
}

export function StarHairPinBadge({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        width: "44px",
        height: "44px",
        filter: "drop-shadow(0 3px 6px rgba(245, 158, 11, 0.45))",
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="starPinGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <path d="M22 68 L72 28" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      <polygon
        points="50,10 61,35 88,37 67,55 74,82 50,67 26,82 33,55 12,37 39,35"
        fill="url(#starPinGold)"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <circle cx="50" cy="46" r="5" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

export function HeartEarring({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1024 1536"
      className={className}
      style={{ ...FULL_STAGE_SVG_STYLE, zIndex: 7, ...style }}
      aria-hidden="true"
    >
      <image href={ACCESSORY_SPRITES.heartEarring} width="1024" height="1536" />
    </svg>
  );
}

export function HeartEarringPair({
  leftEar,
  rightEar,
}: {
  leftEar: { top: string; left: string };
  rightEar: { top: string; left: string };
}) {
  const renderDrop = () => (
    <svg
      viewBox="0 0 60 75"
      style={{
        width: "24px",
        height: "30px",
        filter: "drop-shadow(0 2px 5px rgba(236, 72, 153, 0.5))",
      }}
    >
      <defs>
        <linearGradient id="earHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbcfe8" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#9d174d" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="8" r="5" fill="#fbbf24" stroke="#fff" strokeWidth="1.5" />
      <path d="M30 12 L30 24" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M30 32 C18 18, 4 28, 11 44 C18 56, 30 68, 30 68 C30 68, 42 56, 49 44 C56 28, 42 18, 30 32 Z"
        fill="url(#earHeartGrad)"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <ellipse cx="22" cy="34" rx="4" ry="2.5" fill="#ffffff" opacity="0.7" transform="rotate(-25 22 34)" />
    </svg>
  );
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: leftEar.top,
          left: leftEar.left,
          transform: "translate(-50%, -20%)",
          pointerEvents: "none",
          zIndex: 7,
        }}
        aria-hidden="true"
      >
        {renderDrop()}
      </div>
      <div
        style={{
          position: "absolute",
          top: rightEar.top,
          left: rightEar.left,
          transform: "translate(-50%, -20%)",
          pointerEvents: "none",
          zIndex: 7,
        }}
        aria-hidden="true"
      >
        {renderDrop()}
      </div>
    </>
  );
}

export function MagicWand({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1024 1536"
      className={className}
      style={{ ...FULL_STAGE_SVG_STYLE, zIndex: 7, ...style }}
      aria-hidden="true"
    >
      <image href={ACCESSORY_SPRITES.wand} width="1024" height="1536" />
    </svg>
  );
}

export function BearPochette({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1024 1536"
      className={className}
      style={{ ...FULL_STAGE_SVG_STYLE, zIndex: 7, ...style }}
      aria-hidden="true"
    >
      <image href={ACCESSORY_SPRITES.bagBear} width="1024" height="1536" />
    </svg>
  );
}

export function AngelWings({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1024 1536"
      className={className}
      style={{ ...FULL_STAGE_SVG_STYLE, zIndex: 1, ...style }}
      aria-hidden="true"
    >
      <image href={ACCESSORY_SPRITES.wings} width="1024" height="1536" />
    </svg>
  );
}

export function HairstyleExtension({
  hairstyle,
  hairColor = "hair_color_brown",
  showCleanBun = false,
  layer = "front",
}: {
  hairstyle: string;
  hairColor?: string;
  showCleanBun?: boolean;
  layer?: "back" | "front";
}) {
  if (hairstyle === "hair_bun" && !showCleanBun) return null;

  const spriteHref = HAIRSTYLE_SPRITES[hairstyle] ?? HAIRSTYLE_SPRITES.hair_bun;
  const colorFilter = HAIR_COLOR_FILTERS[hairColor] ?? "none";

  const clipPath =
    layer === "front"
      ? showCleanBun || hairstyle !== "hair_bun"
        ? FRONT_HAIR_CLIP
        : undefined
      : undefined;

  return (
    <svg
      viewBox="0 0 1024 1536"
      style={{
        ...FULL_STAGE_SVG_STYLE,
        zIndex: layer === "back" ? 1 : 4,
        clipPath,
        filter: colorFilter !== "none" ? colorFilter : undefined,
      }}
      aria-hidden="true"
    >
      <image href={spriteHref} width="1024" height="1536" />
    </svg>
  );
}
