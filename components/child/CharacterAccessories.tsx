"use client";

import React from "react";

/**
 * キャラクターの画風に調和する高品位なベクターアクセサリーコンポーネント。
 * OS絵文字ではなく、美しいイラスト調SVGで描画することで、
 * 着せ替え時にキャラクターと完全に馴染みます。
 */

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

      {/* 左リボン輪 */}
      <path
        d="M80 50 C55 15, 10 20, 15 52 C18 70, 50 65, 80 54 Z"
        fill="url(#ribbonMain)"
      />
      <path
        d="M75 48 C55 24, 25 25, 22 45 C35 38, 58 40, 75 48 Z"
        fill="url(#ribbonHighlight)"
      />

      {/* 右リボン輪 */}
      <path
        d="M80 50 C105 15, 150 20, 145 52 C142 70, 110 65, 80 54 Z"
        fill="url(#ribbonMain)"
      />
      <path
        d="M85 48 C105 24, 135 25, 138 45 C125 38, 102 40, 85 48 Z"
        fill="url(#ribbonHighlight)"
      />

      {/* 左の垂れリボン */}
      <path
        d="M72 56 C60 75, 45 95, 38 112 C48 108, 62 104, 75 106 C74 88, 73 70, 72 56 Z"
        fill="url(#ribbonMain)"
      />
      {/* 右の垂れリボン */}
      <path
        d="M88 56 C100 75, 115 95, 122 112 C112 108, 98 104, 85 106 C86 88, 87 70, 88 56 Z"
        fill="url(#ribbonMain)"
      />

      {/* 中央の結び目 */}
      <ellipse cx="80" cy="52" rx="14" ry="12" fill="url(#ribbonKnot)" />
      <ellipse cx="78" cy="48" rx="8" ry="5" fill="#ffe4e6" opacity="0.6" />
    </svg>
  );
}

export function StarHairPin({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={{
        width: "42px",
        height: "42px",
        filter: "drop-shadow(0 3px 6px rgba(245, 158, 11, 0.45))",
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="starGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* ピンの金具 */}
      <path d="M25 65 L70 30" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
      {/* 星のメインボディ */}
      <polygon
        points="50,12 61,35 86,37 67,54 73,79 50,66 27,79 33,54 14,37 39,35"
        fill="url(#starGold)"
        stroke="#fef08a"
        strokeWidth="1.5"
      />
      {/* キラキラ光彩 */}
      <circle cx="50" cy="45" r="5" fill="#ffffff" opacity="0.8" />
      <circle cx="58" cy="38" r="2.5" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

export function HeartEarring({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 60 70"
      className={className}
      style={{
        width: "22px",
        height: "26px",
        filter: "drop-shadow(0 2px 4px rgba(236, 72, 153, 0.4))",
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="heartPink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="60%" stopColor="#db2777" />
          <stop offset="100%" stopColor="#9d174d" />
        </linearGradient>
      </defs>
      {/* 金具フック */}
      <path d="M30 6 C30 14, 30 18, 30 22" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="6" r="3" fill="#f59e0b" />
      {/* ハートジュエル */}
      <path
        d="M30 30 C20 18, 6 26, 12 40 C18 52, 30 62, 30 62 C30 62, 42 52, 48 40 C54 26, 40 18, 30 30 Z"
        fill="url(#heartPink)"
      />
      <ellipse cx="23" cy="32" rx="4" ry="2.5" fill="#ffffff" opacity="0.6" transform="rotate(-30 23 32)" />
    </svg>
  );
}

export function MagicWand({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 160"
      className={className}
      style={{
        width: "56px",
        height: "90px",
        filter: "drop-shadow(0 4px 10px rgba(168, 85, 247, 0.45))",
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wandShaft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="wandStar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* 杖の柄 */}
      <path d="M50 45 L50 150" stroke="url(#wandShaft)" strokeWidth="6" strokeLinecap="round" />
      {/* 装飾リング */}
      <circle cx="50" cy="55" r="6" fill="#f59e0b" />
      <circle cx="50" cy="145" r="5" fill="#f59e0b" />
      {/* 先端の星ジュエル */}
      <polygon
        points="50,10 59,28 78,30 63,44 68,63 50,53 32,63 37,44 22,30 41,28"
        fill="url(#wandStar)"
        stroke="#ffffff"
        strokeWidth="1.5"
      />
      {/* 魔法のキラめき */}
      <circle cx="50" cy="35" r="4" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

export function BearPochette({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      style={{
        width: "54px",
        height: "54px",
        filter: "drop-shadow(0 4px 8px rgba(120, 53, 15, 0.35))",
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bearFur" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="30%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* 斜めがけストラップ */}
      <path d="M10 5 Q 60 40 110 5" stroke="#78350f" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* くまの耳 */}
      <circle cx="36" cy="46" r="14" fill="url(#bearFur)" />
      <circle cx="36" cy="46" r="7" fill="#fef3c7" />
      <circle cx="84" cy="46" r="14" fill="url(#bearFur)" />
      <circle cx="84" cy="46" r="7" fill="#fef3c7" />
      {/* くまの顔（バッグ本体） */}
      <circle cx="60" cy="68" r="32" fill="url(#bearFur)" stroke="#78350f" strokeWidth="2" />
      {/* 鼻まわり */}
      <ellipse cx="60" cy="74" rx="14" ry="10" fill="#fef3c7" />
      <ellipse cx="60" cy="70" rx="5" ry="3.5" fill="#78350f" />
      {/* 目 */}
      <circle cx="48" cy="62" r="3.5" fill="#1e293b" />
      <circle cx="72" cy="62" r="3.5" fill="#1e293b" />
      {/* ほっぺ */}
      <circle cx="42" cy="72" r="4.5" fill="#fda4af" opacity="0.7" />
      <circle cx="78" cy="72" r="4.5" fill="#fda4af" opacity="0.7" />
    </svg>
  );
}

export function AngelWings({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "none",
        filter: "drop-shadow(0 0 12px rgba(254, 240, 138, 0.65))",
        ...style,
      }}
      aria-hidden="true"
    >
      {/* 左翼 */}
      <svg viewBox="0 0 140 180" style={{ width: "90px", height: "115px", transform: "scaleX(-1)" }}>
        <defs>
          <linearGradient id="featherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fed7aa" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <path
          d="M10 90 C15 40, 60 10, 130 5 C115 35, 110 65, 125 90 C100 85, 80 105, 95 130 C75 125, 55 140, 65 165 C45 155, 25 150, 10 130 Z"
          fill="url(#featherGrad)"
          stroke="#fef08a"
          strokeWidth="1.5"
          opacity="0.92"
        />
      </svg>
      {/* 右翼 */}
      <svg viewBox="0 0 140 180" style={{ width: "90px", height: "115px" }}>
        <path
          d="M10 90 C15 40, 60 10, 130 5 C115 35, 110 65, 125 90 C100 85, 80 105, 95 130 C75 125, 55 140, 65 165 C45 155, 25 150, 10 130 Z"
          fill="url(#featherGrad)"
          stroke="#fef08a"
          strokeWidth="1.5"
          opacity="0.92"
        />
      </svg>
    </div>
  );
}

export const HAIR_COLOR_PALETTES: Record<
  string,
  { base: string; dark: string; light: string; highlight: string }
> = {
  hair_color_brown: {
    base: "#7d4e38",
    dark: "#4d2c1d",
    light: "#a66c50",
    highlight: "#d9a389",
  },
  hair_color_black: {
    base: "#27272a",
    dark: "#09090b",
    light: "#52525b",
    highlight: "#a1a1aa",
  },
  hair_color_pink: {
    base: "#ec4899",
    dark: "#be185d",
    light: "#f472b6",
    highlight: "#fbcfe8",
  },
  hair_color_gold: {
    base: "#eab308",
    dark: "#a16207",
    light: "#facc15",
    highlight: "#fef08a",
  },
  hair_color_blue: {
    base: "#0ea5e9",
    dark: "#0369a1",
    light: "#38bdf8",
    highlight: "#bae6fd",
  },
};

export function HairstyleExtension({
  hairstyle,
  hairColor = "hair_color_brown",
}: {
  hairstyle: string;
  hairColor?: string;
}) {
  const palette = HAIR_COLOR_PALETTES[hairColor] ?? HAIR_COLOR_PALETTES.hair_color_brown;
  const gradId = `hairGrad_${hairstyle}_${hairColor}`;
  const shadowGradId = `hairShadow_${hairstyle}_${hairColor}`;

  if (hairstyle === "hair_bun") return null;

  return (
    <svg
      viewBox="0 0 1024 1536"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 4,
        filter: "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.18))",
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="45%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={shadowGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.base} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
      </defs>

      {/* 1. ふわふわツインテール */}
      {hairstyle === "hair_twintail" && (
        <g>
          {/* 左ツインテール */}
          <path
            d="M280 280 C160 270, 95 380, 125 530 C145 630, 210 680, 255 640 C220 580, 230 480, 290 380 Z"
            fill={`url(#${gradId})`}
            stroke={palette.dark}
            strokeWidth="4"
          />
          {/* 左ツインテール毛流れハイライト */}
          <path
            d="M245 310 C165 340, 140 440, 165 550"
            stroke={palette.highlight}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            opacity="0.65"
          />
          {/* 左ツインテール結び目リボン */}
          <circle cx="275" cy="285" r="24" fill="#f43f5e" />
          <circle cx="268" cy="278" r="8" fill="#fda4af" />

          {/* 右ツインテール */}
          <path
            d="M745 270 C865 260, 930 370, 900 520 C880 620, 815 670, 770 630 C805 570, 795 470, 735 370 Z"
            fill={`url(#${gradId})`}
            stroke={palette.dark}
            strokeWidth="4"
          />
          {/* 右ツインテール毛流れハイライト */}
          <path
            d="M780 300 C860 330, 885 430, 860 540"
            stroke={palette.highlight}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            opacity="0.65"
          />
          {/* 右ツインテール結び目リボン */}
          <circle cx="750" cy="275" r="24" fill="#f43f5e" />
          <circle cx="743" cy="268" r="8" fill="#fda4af" />
        </g>
      )}

      {/* 2. すっきりポニーテール */}
      {hairstyle === "hair_pony" && (
        <g>
          <path
            d="M620 160 C770 110, 920 200, 910 380 C900 490, 820 550, 770 500 C810 430, 780 310, 650 250 Z"
            fill={`url(#${gradId})`}
            stroke={palette.dark}
            strokeWidth="4"
          />
          <path
            d="M680 185 C800 175, 870 260, 855 390"
            stroke={palette.highlight}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
          {/* ポニーテールシュシュ */}
          <ellipse cx="635" cy="195" rx="22" ry="30" transform="rotate(-25 635 195)" fill="#fbbf24" />
        </g>
      )}

      {/* 3. さらさらボブ */}
      {hairstyle === "hair_bob" && (
        <g>
          {/* 左サイド内巻きボブ */}
          <path
            d="M275 310 C220 400, 235 530, 345 595 C380 615, 415 590, 395 555 C345 510, 330 420, 345 340 Z"
            fill={`url(#${gradId})`}
            stroke={palette.dark}
            strokeWidth="3.5"
          />
          <path
            d="M285 360 C260 440, 280 520, 350 565"
            stroke={palette.highlight}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          {/* 右サイド内巻きボブ */}
          <path
            d="M750 300 C805 390, 790 520, 680 585 C645 605, 610 580, 630 545 C680 500, 695 410, 680 330 Z"
            fill={`url(#${gradId})`}
            stroke={palette.dark}
            strokeWidth="3.5"
          />
          <path
            d="M740 350 C765 430, 745 510, 675 555"
            stroke={palette.highlight}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </g>
      )}

      {/* 4. プリンセスウェーブ (ロングウェーブ) */}
      {hairstyle === "hair_long_wave" && (
        <g>
          {/* 左ロングウェーブ */}
          <path
            d="M270 300 C170 380, 190 500, 150 610 C120 690, 190 770, 280 730 C240 660, 280 560, 260 470 C250 400, 310 360, 330 320 Z"
            fill={`url(#${gradId})`}
            stroke={palette.dark}
            strokeWidth="4"
          />
          <path
            d="M245 350 C195 430, 225 530, 185 630 C170 675, 200 715, 245 705"
            stroke={palette.highlight}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            opacity="0.65"
          />
          {/* 右ロングウェーブ */}
          <path
            d="M755 290 C855 370, 835 490, 875 600 C905 680, 835 760, 745 720 C785 650, 745 550, 765 460 C775 390, 715 350, 695 310 Z"
            fill={`url(#${gradId})`}
            stroke={palette.dark}
            strokeWidth="4"
          />
          <path
            d="M780 340 C830 420, 800 520, 840 620 C855 665, 825 705, 780 695"
            stroke={palette.highlight}
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            opacity="0.65"
          />
        </g>
      )}
    </svg>
  );
}
