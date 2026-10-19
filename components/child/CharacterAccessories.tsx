"use client";

import React from "react";

/**
 * キャラクターの3Dイラスト画風に完全調和する高品位な着せ替え・髪型・アクセサリーコンポーネント。
 * 元のキャラクター画像（kanoha-ref-happy.png）をベースに画像生成した3Dレンダリングアセットを
 * フル解像度（1024x1536）のSVGレイヤーとして精密合成します。
 */

export const HAIRSTYLE_SPRITES: Record<string, string> = {
  hair_fluffy: "/images/character/kanoha-ref-hair-fluffy.png",
  hair_bun: "/images/character/kanoha-ref-hair-bun.png",
  hair_bun_underhat: "/images/character/kanoha-ref-hair-bun-underhat.png",
  hair_bob: "/images/character/kanoha-ref-hair-bob.png",
  hair_twintail: "/images/character/kanoha-ref-hair-twintail.png",
  hair_pony: "/images/character/kanoha-ref-hair-pony.png",
  hair_side_tail: "/images/character/kanoha-ref-hair-side-tail.png",
  hair_long_wave: "/images/character/kanoha-ref-hair-long-wave.png",
  hair_twin_bun: "/images/character/kanoha-ref-hair-twin-bun.png",
  hair_braid: "/images/character/kanoha-ref-hair-braid.png",
  hair_halfup: "/images/character/kanoha-ref-hair-halfup.png",
};

export const FUWARI_HAIRSTYLE_SPRITES: Record<string, string> = {
  hair_bun: "/images/character/chars/fuwari-style-bun.png",
  hair_bob: "/images/character/chars/fuwari-style-bob.png",
  hair_twintail: "/images/character/chars/fuwari-style-twintail.png",
  hair_pony: "/images/character/chars/fuwari-style-pony.png",
  hair_side_tail: "/images/character/chars/fuwari-style-side-tail.png",
  hair_long_wave: "/images/character/chars/fuwari-style-long-wave.png",
  hair_twin_bun: "/images/character/chars/fuwari-style-twin-bun.png",
  hair_braid: "/images/character/chars/fuwari-style-braid.png",
  hair_halfup: "/images/character/chars/fuwari-style-halfup.png",
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
  hair_color_silver: "saturate(0.12) brightness(1.38) contrast(0.95)",
  hair_color_black: "saturate(0.2) brightness(0.42) contrast(1.3)",
  hair_color_pink: "sepia(0.55) hue-rotate(295deg) saturate(2.6) brightness(1.1)",
  hair_color_gold: "sepia(0.85) hue-rotate(16deg) saturate(3.2) brightness(1.25)",
  hair_color_blue: "sepia(0.65) hue-rotate(175deg) saturate(2.8) brightness(1.1)",
};

export function resolveCharacterHairFilter(
  charId: string,
  hairColor: string | undefined,
): string {
  if (!hairColor) return "none";

  // シルバーヘア標準のキャラクター（ふわり・レン）
  if (charId === "char_fuwari" || charId === "char_ren") {
    if (hairColor === "hair_color_silver") return "none";
    if (hairColor === "hair_color_brown") {
      return "sepia(0.78) hue-rotate(342deg) saturate(2.1) brightness(0.88)";
    }
    return HAIR_COLOR_FILTERS[hairColor] ?? "none";
  }

  // 黒髪標準のキャラクター（リク）
  if (charId === "char_riku") {
    if (hairColor === "hair_color_black") return "none";
    if (hairColor === "hair_color_brown") {
      return "sepia(0.85) hue-rotate(345deg) saturate(2.4) brightness(1.45)";
    }
    if (hairColor === "hair_color_silver") {
      return "saturate(0.1) brightness(2.1) contrast(0.85)";
    }
    return HAIR_COLOR_FILTERS[hairColor] ?? "none";
  }

  // ブラウンヘア標準のキャラクター（かのは・ひなた・ミア）
  return HAIR_COLOR_FILTERS[hairColor] ?? "none";
}

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

// 背面髪型レイヤー用クリップ：頭頂部・おでこ・顔（y < 35%）を完全に除外し、肩の後ろ・背中に垂れる毛束（y: 35%〜70%）のみを描画
const BACK_HAIR_CLIP =
  "polygon(0% 35%, 100% 35%, 100% 70%, 0% 70%)";

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
  // ショート・アップ系 (hair_bun, hair_bob, hair_fluffy, hair_twin_bun) は背中に垂れる髪がないため、
  // 背面レイヤー (layer === "back") は描画せず、前の髪型の残骸や隙間からの透けを完全に防ぐ
  if (
    layer === "back" &&
    (hairstyle === "hair_bun" ||
      hairstyle === "hair_bob" ||
      hairstyle === "hair_fluffy" ||
      hairstyle === "hair_twin_bun")
  ) {
    return null;
  }

  const spriteKey =
    hairstyle === "hair_bun" && !showCleanBun ? "hair_bun_underhat" : hairstyle;
  const spriteHref = HAIRSTYLE_SPRITES[spriteKey] ?? HAIRSTYLE_SPRITES.hair_bun;
  const colorFilter = HAIR_COLOR_FILTERS[hairColor] ?? "none";

  const clipPath = layer === "front" ? FRONT_HAIR_CLIP : BACK_HAIR_CLIP;

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

/**
 * ふわりちゃん等の新規キャラクター（768x1024）向け髪型オーバーレイコンポーネント。
 * ふわりちゃんのシルバーラベンダー髪色にピクセル単位で調和した髪型スプライトを
 * 前面（おだんご・ハーフアップリボン等）および背面（ツインテール・ボブ・ポニーテール・三つ編み・ウェーブ等）に合成します。
 */
export function NewCharacterHairstyleOverlay({
  hairstyle,
  hairColor,
  layer = "back",
  baseToneFilter = "none",
  transform,
  hideTopBun = false,
}: {
  hairstyle: string;
  hairColor?: string;
  layer?: "back" | "front";
  baseToneFilter?: string;
  transform?: string;
  hideTopBun?: boolean;
}) {
  // ふわふわエアリー (hair_fluffy) はベーススプライト標準のショートヘア
  if (!hairstyle || hairstyle === "hair_fluffy") {
    return null;
  }

  // FUWARI_HAIRSTYLE_SPRITES はシルバーラベンダー基準のため、茶髪選択時はブラウン変換フィルターを適用
  let colorFilter = baseToneFilter;
  if (hairColor === "hair_color_brown") {
    colorFilter = "sepia(0.78) hue-rotate(342deg) saturate(2.1) brightness(0.88)";
  } else if (hairColor === "hair_color_silver") {
    colorFilter = "none";
  } else if (hairColor && HAIR_COLOR_FILTERS[hairColor] && HAIR_COLOR_FILTERS[hairColor] !== "none") {
    colorFilter = HAIR_COLOR_FILTERS[hairColor];
  }

  // おだんごアップ (hair_bun) は頭頂部前面レイヤーに描画し、背面には描画しない
  if (hairstyle === "hair_bun") {
    if (layer !== "front" || hideTopBun) return null;
    return (
      <svg
        viewBox="0 0 768 1024"
        data-hairstyle={hairstyle}
        data-layer="front"
        style={{
          ...FULL_STAGE_SVG_STYLE,
          zIndex: 3,
          filter: colorFilter !== "none" ? colorFilter : undefined,
          transform,
          transformOrigin: "50% 18%",
        }}
        aria-hidden="true"
      >
        <image href={FUWARI_HAIRSTYLE_SPRITES.hair_bun} width="768" height="1024" />
      </svg>
    );
  }

  // ハーフアップ・サイドテールの前面リボンアクセント
  if (layer === "front") {
    if (hairstyle === "hair_halfup") {
      return (
        <svg
          viewBox="0 0 768 1024"
          data-hairstyle={hairstyle}
          data-layer="front"
          style={{
            ...FULL_STAGE_SVG_STYLE,
            zIndex: 4,
            transform,
            transformOrigin: "50% 18%",
          }}
          aria-hidden="true"
        >
          {/* 左こめかみのハーフアップリボン */}
          <g transform="translate(232, 118) rotate(-18)">
            <ellipse cx="-16" cy="0" rx="18" ry="11" fill="#c084fc" stroke="#7e22ce" strokeWidth="2.5" />
            <ellipse cx="16" cy="0" rx="18" ry="11" fill="#c084fc" stroke="#7e22ce" strokeWidth="2.5" />
            <path d="M-6 6 L-14 26 L-2 22 Z" fill="#a855f7" stroke="#7e22ce" strokeWidth="2" />
            <path d="M6 6 L14 26 L2 22 Z" fill="#a855f7" stroke="#7e22ce" strokeWidth="2" />
            <circle cx="0" cy="0" r="7" fill="#e9d5ff" stroke="#7e22ce" strokeWidth="2.5" />
          </g>
          {/* 右こめかみのハーフアップリボン */}
          <g transform="translate(546, 134) rotate(18)">
            <ellipse cx="-16" cy="0" rx="18" ry="11" fill="#c084fc" stroke="#7e22ce" strokeWidth="2.5" />
            <ellipse cx="16" cy="0" rx="18" ry="11" fill="#c084fc" stroke="#7e22ce" strokeWidth="2.5" />
            <path d="M-6 6 L-14 26 L-2 22 Z" fill="#a855f7" stroke="#7e22ce" strokeWidth="2" />
            <path d="M6 6 L14 26 L2 22 Z" fill="#a855f7" stroke="#7e22ce" strokeWidth="2" />
            <circle cx="0" cy="0" r="7" fill="#e9d5ff" stroke="#7e22ce" strokeWidth="2.5" />
          </g>
        </svg>
      );
    }

    if (hairstyle === "hair_side_tail") {
      return (
        <svg
          viewBox="0 0 768 1024"
          data-hairstyle={hairstyle}
          data-layer="front"
          style={{
            ...FULL_STAGE_SVG_STYLE,
            zIndex: 4,
            transform,
            transformOrigin: "50% 18%",
          }}
          aria-hidden="true"
        >
          {/* サイドテールの結び目リボン＆スター */}
          <g transform="translate(238, 122) rotate(-22)">
            <ellipse cx="-20" cy="0" rx="22" ry="13" fill="#f472b6" stroke="#be185d" strokeWidth="2.5" />
            <ellipse cx="20" cy="0" rx="22" ry="13" fill="#f472b6" stroke="#be185d" strokeWidth="2.5" />
            <path d="M-8 8 L-18 32 L-4 27 Z" fill="#ec4899" stroke="#be185d" strokeWidth="2" />
            <path d="M8 8 L18 32 L4 27 Z" fill="#ec4899" stroke="#be185d" strokeWidth="2" />
            <circle cx="0" cy="0" r="9" fill="#fde047" stroke="#ca8a04" strokeWidth="2.5" />
          </g>
        </svg>
      );
    }

    return null;
  }

  // 背面レイヤー (layer === "back")
  const spriteHref = FUWARI_HAIRSTYLE_SPRITES[hairstyle];
  if (!spriteHref) return null;

  return (
    <svg
      viewBox="0 0 768 1024"
      data-hairstyle={hairstyle}
      data-layer="back"
      style={{
        ...FULL_STAGE_SVG_STYLE,
        zIndex: 1,
        filter: colorFilter !== "none" ? colorFilter : undefined,
        transform,
        transformOrigin: "50% 20%",
      }}
      aria-hidden="true"
    >
      <image href={spriteHref} width="768" height="1024" />
    </svg>
  );
}

const CHARACTER_EYE_TRANSFORMS: Record<string, { cx: number; cy: number; angle: number; scale: number }> = {
  char_fuwari: { cx: 388, cy: 226, angle: -15, scale: 1.0 },
  char_hinata: { cx: 375, cy: 245, angle: 12, scale: 1.04 },
  char_ren: { cx: 356, cy: 168, angle: -24, scale: 0.86 },
  char_riku: { cx: 451, cy: 211, angle: 16, scale: 0.96 },
  char_mia: { cx: 387, cy: 192, angle: -8, scale: 0.96 },
};

/**
 * 新規5キャラクター（768x1024）向けのメガネ（まるめがね・ほしのサングラス）オーバーレイ。
 * 各キャラクターの瞳座標・首の傾きに精密追従して3D質感のアイウェアを描画します。
 */
export function NewCharacterGlassesOverlay({
  charId,
  glasses,
}: {
  charId: string;
  glasses?: string;
}) {
  if (!glasses || glasses === "glasses_none") {
    return null;
  }

  const eye = CHARACTER_EYE_TRANSFORMS[charId] ?? CHARACTER_EYE_TRANSFORMS.char_fuwari;

  return (
    <svg
      viewBox="0 0 768 1024"
      data-glasses={glasses}
      style={{
        ...FULL_STAGE_SVG_STYLE,
        zIndex: 6,
        filter: "drop-shadow(0 3px 6px rgba(30, 20, 40, 0.25))",
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="roundFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="lensGlintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="starLensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.82" />
          <stop offset="55%" stopColor="#f472b6" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id="starFrameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="50%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>

      <g transform={`translate(${eye.cx}, ${eye.cy}) rotate(${eye.angle}) scale(${eye.scale})`}>
        {glasses === "glasses_round" ? (
          <>
            {/* テンプル（つる） */}
            <path d="M-98 -6 L-118 -14" stroke="url(#roundFrameGrad)" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M98 -6 L118 -14" stroke="url(#roundFrameGrad)" strokeWidth="4.5" strokeLinecap="round" />
            {/* ブリッジ */}
            <path d="M-16 -4 Q0 -14 16 -4" fill="none" stroke="url(#roundFrameGrad)" strokeWidth="5" strokeLinecap="round" />
            {/* 左右の丸レンズとフレーム */}
            <circle cx="-56" cy="0" r="42" fill="url(#lensGlintGrad)" stroke="url(#roundFrameGrad)" strokeWidth="6" />
            <circle cx="56" cy="0" r="42" fill="url(#lensGlintGrad)" stroke="url(#roundFrameGrad)" strokeWidth="6" />
            {/* レンズのハイライト */}
            <path d="M-78 -22 Q-64 -32 -44 -26" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
            <path d="M34 -22 Q48 -32 68 -26" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
          </>
        ) : (
          <>
            {/* テンプル（つる） */}
            <path d="M-98 -6 L-120 -14" stroke="url(#starFrameGrad)" strokeWidth="5" strokeLinecap="round" />
            <path d="M98 -6 L120 -14" stroke="url(#starFrameGrad)" strokeWidth="5" strokeLinecap="round" />
            {/* ブリッジ */}
            <path d="M-18 -4 Q0 -14 18 -4" fill="none" stroke="url(#starFrameGrad)" strokeWidth="6" strokeLinecap="round" />
            {/* 左の星型サングラスレンズ */}
            <g transform="translate(-56, 0)">
              <polygon
                points="0,-48 14,-16 48,-12 22,12 29,46 0,28 -29,46 -22,12 -48,-12 -14,-16"
                fill="url(#starLensGrad)"
                stroke="url(#starFrameGrad)"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
              <path d="M-16 -18 L6 -32" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.85" />
            </g>
            {/* 右の星型サングラスレンズ */}
            <g transform="translate(56, 0)">
              <polygon
                points="0,-48 14,-16 48,-12 22,12 29,46 0,28 -29,46 -22,12 -48,-12 -14,-16"
                fill="url(#starLensGrad)"
                stroke="url(#starFrameGrad)"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />
              <path d="M-16 -18 L6 -32" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.85" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}

const CHARACTER_HAND_COORDS: Record<
  string,
  { left: { x: number; y: number; rot: number; scale: number }; right: { x: number; y: number; rot: number; scale: number } }
> = {
  char_fuwari: {
    left: { x: 205, y: 318, rot: -28, scale: 1.0 },
    right: { x: 585, y: 552, rot: 35, scale: 0.92 },
  },
  char_hinata: {
    left: { x: 268, y: 404, rot: 22, scale: 0.95 },
    right: { x: 562, y: 552, rot: -25, scale: 0.92 },
  },
  char_ren: {
    left: { x: 245, y: 465, rot: 15, scale: 0.88 },
    right: { x: 445, y: 468, rot: -15, scale: 0.88 },
  },
  char_riku: {
    left: { x: 118, y: 432, rot: 25, scale: 0.92 },
    right: { x: 518, y: 392, rot: -20, scale: 0.95 },
  },
  char_mia: {
    left: { x: 362, y: 548, rot: 15, scale: 0.82 },
    right: { x: 408, y: 548, rot: -15, scale: 0.82 },
  },
};

/**
 * 新規キャラクター向けの手袋（しろいミトン・きんのグローブ）SVGオーバーレイ。
 * 専用3D手袋スプライトを持たないキャラクター・衣装でも確実にミトン/ゴールドグローブを装着表示します。
 */
export function NewCharacterGlovesOverlay({
  charId,
  gloves,
}: {
  charId: string;
  gloves?: string;
}) {
  if (!gloves || gloves === "gloves_none") {
    return null;
  }

  const coords = CHARACTER_HAND_COORDS[charId] ?? CHARACTER_HAND_COORDS.char_fuwari;
  const isGold = gloves === "gloves_gold";

  const renderGlove = (pos: { x: number; y: number; rot: number; scale: number }, flip: boolean) => (
    <g
      transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rot}) scale(${flip ? -pos.scale : pos.scale}, ${pos.scale})`}
    >
      {/* もこもこカフス / ガントレットカフス */}
      <rect
        x="-34"
        y="12"
        width="68"
        height="26"
        rx="13"
        fill={isGold ? "#facc15" : "#ffffff"}
        stroke={isGold ? "#a16207" : "#cbd5e1"}
        strokeWidth="3.5"
      />
      {/* ミトン本体 */}
      <ellipse
        cx="0"
        cy="-12"
        rx="32"
        ry="34"
        fill={isGold ? "#fde047" : "#fff1f2"}
        stroke={isGold ? "#a16207" : "#f472b6"}
        strokeWidth="3.5"
      />
      {/* 親指 */}
      <ellipse
        cx="28"
        cy="-6"
        rx="14"
        ry="18"
        transform="rotate(28 28 -6)"
        fill={isGold ? "#facc15" : "#fda4af"}
        stroke={isGold ? "#a16207" : "#f472b6"}
        strokeWidth="3"
      />
      {/* ハイライト / 宝石モチーフ */}
      {isGold ? (
        <polygon
          points="0,-24 8,-12 0,0 -8,-12"
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth="2"
        />
      ) : (
        <ellipse cx="-8" cy="-22" rx="12" ry="7" fill="#ffffff" opacity="0.85" />
      )}
    </g>
  );

  return (
    <svg
      viewBox="0 0 768 1024"
      data-gloves={gloves}
      style={{
        ...FULL_STAGE_SVG_STYLE,
        zIndex: 5,
        filter: "drop-shadow(0 4px 8px rgba(30, 20, 40, 0.2))",
      }}
      aria-hidden="true"
    >
      {renderGlove(coords.left, false)}
      {renderGlove(coords.right, true)}
    </svg>
  );
}


