"use client";

import React from "react";

/**
 * キャラクターの3Dイラスト画風に完全調和する高品位な着せ替え・髪型・アクセサリーコンポーネント。
 * 元のキャラクター画像（kanoha-ref-happy.png）をベースに画像生成した3Dレンダリングアセットを
 * フル解像度（1024x1536）のSVGレイヤーとして精密合成します。
 */

export const HAIRSTYLE_SPRITES: Record<string, string> = {
  hair_bun: "/images/character/kanoha-ref-hair-bun.png",
  hair_bob: "/images/character/kanoha-ref-hair-bob.png",
  hair_twintail: "/images/character/kanoha-ref-hair-twintail.png",
  hair_pony: "/images/character/kanoha-ref-hair-pony.png",
  hair_long_wave: "/images/character/kanoha-ref-hair-long-wave.png",
};

export const ACCESSORY_SPRITES = {
  pinStar: "/images/character/kanoha-ref-acc-pin-star.png",
  heartEarring: "/images/character/kanoha-ref-acc-heart-earring.png",
  wand: "/images/character/kanoha-ref-acc-wand.png",
  bagBear: "/images/character/kanoha-ref-acc-bag-bear.png",
  wings: "/images/character/kanoha-ref-acc-wings.png",
} as const;

export const HAIR_COLOR_FILTERS: Record<string, string> = {
  hair_color_brown: "none",
  hair_color_black: "saturate(0.2) brightness(0.42) contrast(1.3)",
  hair_color_pink: "sepia(0.55) hue-rotate(295deg) saturate(2.6) brightness(1.1)",
  hair_color_gold: "sepia(0.85) hue-rotate(16deg) saturate(3.2) brightness(1.25)",
  hair_color_blue: "sepia(0.65) hue-rotate(175deg) saturate(2.8) brightness(1.1)",
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

  // 大きな帽子を被っている場合は頭頂部(y < 18%)をクリップして帽子の外にはみ出さないようにする
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
