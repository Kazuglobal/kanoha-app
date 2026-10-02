"use client";

import React, { useState, useEffect } from "react";
import styles from "@/components/kanoha.module.css";
import type { EquippedAccessories } from "@/lib/rewards/characterGrowthStore";

interface AnimeCharacterGirlProps {
  mood?: "happy" | "think" | "celebrate";
  level?: number;
  accessories?: EquippedAccessories;
  className?: string;
  onClick?: () => void;
}

/**
 * 本格セルアニメ調の女の子キャラクター「かのはちゃん」
 * 頭のてっぺんから足のつま先まで、生き生きとした瞳、ふんわりツインテール、
 * 細部まで作り込まれた制服・プリーツスカート・レースソックス・シューズを完全再現。
 */
export function AnimeCharacterGirl({
  mood = "happy",
  level = 1,
  accessories,
  className,
  onClick,
}: AnimeCharacterGirlProps) {
  const [blink, setBlink] = useState(false);

  // 自然なアニメ調のまばたきループ
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const triggerBlink = () => {
      setBlink(true);
      setTimeout(() => {
        setBlink(false);
        const nextBlinkTime = 2200 + Math.random() * 2800;
        timeoutId = setTimeout(triggerBlink, nextBlinkTime);
      }, 150);
    };

    timeoutId = setTimeout(triggerBlink, 1800);
    return () => clearTimeout(timeoutId);
  }, []);

  const clothes = accessories?.clothes || "clothes_school";
  const hat = accessories?.hat || "hat_none";
  // デフォルトは素顔（メガネなし）。指定がある時のみ着用
  const glasses = accessories?.glasses ?? "glasses_none";
  const gloves = accessories?.gloves || "gloves_none";

  return (
    <div
      className={`${styles.animeGirlContainer || ""} ${className || ""}`}
      data-mood={mood}
      onClick={onClick}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        userSelect: "none",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <svg
        viewBox="0 0 180 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
          filter: "drop-shadow(0 8px 16px rgba(19, 34, 56, 0.15))",
        }}
        className={mood === "celebrate" ? styles.celebrateJump : styles.idleBreath}
      >
        <defs>
          {/* 髪色グラデーション（柔らかなショコラブラウン） */}
          <linearGradient id="girlHairGrad" x1="50" y1="15" x2="130" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9d623d" />
            <stop offset="45%" stopColor="#7c4322" />
            <stop offset="100%" stopColor="#542810" />
          </linearGradient>

          {/* ツインテールの毛先グラデーション */}
          <linearGradient id="girlTailGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8d522f" />
            <stop offset="70%" stopColor="#6e3718" />
            <stop offset="100%" stopColor="#4e210a" />
          </linearGradient>

          {/* 天使の輪（髪ハイライト） */}
          <linearGradient id="girlHaloGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255, 240, 225, 0)" />
            <stop offset="25%" stopColor="rgba(255, 235, 210, 0.6)" />
            <stop offset="50%" stopColor="rgba(255, 250, 240, 0.95)" />
            <stop offset="75%" stopColor="rgba(255, 235, 210, 0.6)" />
            <stop offset="100%" stopColor="rgba(255, 240, 225, 0)" />
          </linearGradient>

          {/* アニメ白肌グラデーション */}
          <linearGradient id="girlSkinGrad" x1="60" y1="35" x2="120" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff8f2" />
            <stop offset="70%" stopColor="#feeddd" />
            <stop offset="100%" stopColor="#f7d5be" />
          </linearGradient>

          {/* 瞳のグラデーション（エメラルド〜スカイブルーの宝石のような瞳） */}
          <linearGradient id="girlEyeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d244a" />
            <stop offset="35%" stopColor="#0284c7" />
            <stop offset="70%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* 制服ブレザー・ベスト（清楚なクラシックネイビー） */}
          <linearGradient id="girlUniformGrad" x1="50" y1="100" x2="130" y2="145" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#253a5e" />
            <stop offset="55%" stopColor="#1a2b47" />
            <stop offset="100%" stopColor="#0f1c30" />
          </linearGradient>

          {/* プリーツスカート（エレガントなチェック/シャドウ） */}
          <linearGradient id="girlSkirtGrad" x1="50" y1="130" x2="130" y2="165" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#43526e" />
            <stop offset="100%" stopColor="#2a3449" />
          </linearGradient>

          {/* 胸元のビッグリボンタイ（華やかなコーラルレッド） */}
          <linearGradient id="girlRibbonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff5376" />
            <stop offset="55%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>

          {/* シューズのエナメル光沢グラデーション */}
          <linearGradient id="girlShoeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#63391d" />
            <stop offset="60%" stopColor="#451e08" />
            <stop offset="100%" stopColor="#290e02" />
          </linearGradient>
        </defs>

        {/* 1. 地面のやわらかなシャドウ */}
        <ellipse cx="90" cy="220" rx="46" ry="6" fill="rgba(19, 34, 56, 0.22)" />

        {/* 2. レベル成長オーラ（Lv.4以上で背後にふんわり光るパーティクル） */}
        {level >= 4 && (
          <g opacity="0.75">
            <circle cx="45" cy="85" r="2.5" fill="#fef08a" />
            <circle cx="135" cy="80" r="3" fill="#fbcfe8" />
            <circle cx="38" cy="130" r="2" fill="#bae6fd" />
            <circle cx="142" cy="135" r="2.5" fill="#fef08a" />
            <path d="M90 12 L92 18 L98 20 L92 22 L90 28 L88 22 L82 20 L88 18 Z" fill="#fef08a" />
          </g>
        )}

        {/* 3. 着せ替え特殊マント・ローブ（背部） */}
        {clothes === "clothes_hero" && (
          <path
            d="M50 110 L90 100 L130 110 L142 195 C142 195 90 205 38 195 Z"
            fill="#e11d48"
            stroke="#9f1239"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}
        {clothes === "clothes_wizard" && (
          <path
            d="M48 108 L90 98 L132 108 L140 190 C140 190 90 200 40 190 Z"
            fill="#581c87"
            stroke="#3b0764"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}

        {/* 4. 後頭部の髪（ふんわりボブベース） */}
        <circle cx="90" cy="62" r="42" fill="url(#girlHairGrad)" stroke="#1a2436" strokeWidth="2.8" />

        {/* 5. 左右の愛らしいツインテール（毛先のカールとリボン） */}
        {/* 左ツインテール */}
        <g transform="translate(38, 58)">
          {/* ツインテールのピンクのリボンゴム */}
          <ellipse cx="6" cy="6" rx="6" ry="4" fill="#ff4d79" stroke="#1a2436" strokeWidth="1.6" />
          <circle cx="6" cy="6" r="2" fill="#fff" />
          {/* ふんわりカールした毛束 */}
          <path
            d="M6 8 C-10 22 -16 42 -4 60 C4 66 12 55 10 44 C8 32 12 20 10 9 Z"
            fill="url(#girlTailGrad)"
            stroke="#1a2436"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* 毛束の内側シャドウライン */}
          <path d="M-2 30 C-4 44 2 52 4 56" stroke="#4e210a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>

        {/* 右ツインテール */}
        <g transform="translate(128, 58)">
          <ellipse cx="6" cy="6" rx="6" ry="4" fill="#ff4d79" stroke="#1a2436" strokeWidth="1.6" />
          <circle cx="6" cy="6" r="2" fill="#fff" />
          <path
            d="M6 8 C22 22 28 42 16 60 C8 66 0 55 2 44 C4 32 0 20 2 9 Z"
            fill="url(#girlTailGrad)"
            stroke="#1a2436"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M14 30 C16 44 10 52 8 56" stroke="#4e210a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>

        {/* 6. 女の子の脚（太もも〜すね：白く透明感のある肌） */}
        {/* 左脚 */}
        <rect
          x="68"
          y="158"
          width="18"
          height="28"
          rx="9"
          fill="url(#girlSkinGrad)"
          stroke="#1a2436"
          strokeWidth="2.2"
        />
        {/* 膝のほんのりピンクハイライト */}
        <ellipse cx="77" cy="168" rx="4.5" ry="3" fill="#f9a8d4" opacity="0.45" />

        {/* 右脚 */}
        <rect
          x="94"
          y="158"
          width="18"
          height="28"
          rx="9"
          fill="url(#girlSkinGrad)"
          stroke="#1a2436"
          strokeWidth="2.2"
        />
        <ellipse cx="103" cy="168" rx="4.5" ry="3" fill="#f9a8d4" opacity="0.45" />

        {/* 7. レースフリル付きの白クルーソックス */}
        {/* 左ソックス */}
        <g>
          <rect x="68" y="174" width="18" height="26" rx="6" fill="#ffffff" stroke="#1a2436" strokeWidth="2.2" />
          {/* ソックスの立体影 */}
          <path d="M69 184 L85 184 L85 198 L69 198 Z" fill="#e2e8f0" opacity="0.35" />
          {/* 履き口のふんわりレースフリル */}
          <path
            d="M66 174 Q70 171 74 174 Q78 171 82 174 Q86 171 90 174"
            stroke="#1a2436"
            strokeWidth="2"
            fill="#ffffff"
          />
          {/* ワンポイントのピンクリボン刺繍 */}
          <ellipse cx="77" cy="179" rx="2" ry="1.2" fill="#f43f5e" />
        </g>

        {/* 右ソックス */}
        <g>
          <rect x="94" y="174" width="18" height="26" rx="6" fill="#ffffff" stroke="#1a2436" strokeWidth="2.2" />
          <path d="M95 184 L111 184 L111 198 L95 198 Z" fill="#e2e8f0" opacity="0.35" />
          <path
            d="M92 174 Q96 171 100 174 Q104 171 108 174 Q112 171 116 174"
            stroke="#1a2436"
            strokeWidth="2"
            fill="#ffffff"
          />
          <ellipse cx="103" cy="179" rx="2" ry="1.2" fill="#f43f5e" />
        </g>

        {/* 8. つややかなエナメルワンストラップシューズ（メリージェーン） */}
        {/* 左足シューズ */}
        <g transform="translate(60, 196)">
          {/* 靴底ソール */}
          <rect x="0" y="13" width="32" height="7.5" rx="3.5" fill="#1e293b" stroke="#1a2436" strokeWidth="2" />
          {/* 靴本体 */}
          <path
            d="M4 6 C4 6 12 3 22 6 C26 8 28 12 28 14 L4 14 Z"
            fill="url(#girlShoeGrad)"
            stroke="#1a2436"
            strokeWidth="2.2"
          />
          {/* 甲のストラップ＆小さな金バックル */}
          <rect x="10" y="7" width="11" height="3" rx="1.5" fill="#451e08" stroke="#1a2436" strokeWidth="1.2" />
          <circle cx="15" cy="8.5" r="1.3" fill="#facc15" />
          {/* つま先のツヤツヤ光沢ハイライト */}
          <ellipse cx="23" cy="9" rx="3" ry="1.8" fill="rgba(255, 255, 255, 0.75)" />
        </g>

        {/* 右足シューズ */}
        <g transform="translate(88, 196)">
          <rect x="0" y="13" width="32" height="7.5" rx="3.5" fill="#1e293b" stroke="#1a2436" strokeWidth="2" />
          <path
            d="M4 6 C4 6 12 3 22 6 C26 8 28 12 28 14 L4 14 Z"
            fill="url(#girlShoeGrad)"
            stroke="#1a2436"
            strokeWidth="2.2"
          />
          <rect x="11" y="7" width="11" height="3" rx="1.5" fill="#451e08" stroke="#1a2436" strokeWidth="1.2" />
          <circle cx="16" cy="8.5" r="1.3" fill="#facc15" />
          <ellipse cx="23" cy="9" rx="3" ry="1.8" fill="rgba(255, 255, 255, 0.75)" />
        </g>

        {/* 9. プリーツスカート（女の子らしいふんわりAライン） */}
        <g>
          {/* スカート本体 */}
          <path
            d="M56 134 C56 134 72 131 90 131 C108 131 124 134 124 134 L132 165 C118 168 90 169 48 165 Z"
            fill={
              clothes === "clothes_tshirt"
                ? "#2563eb"
                : clothes === "clothes_safari"
                ? "#ca8a04"
                : clothes === "clothes_hoodie"
                ? "#ec4899"
                : "url(#girlSkirtGrad)"
            }
            stroke="#1a2436"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />

          {/* プリーツひだのシャドウとライン */}
          <line x1="68" y1="133" x2="62" y2="165" stroke="#1e293b" strokeWidth="1.8" />
          <line x1="80" y1="132" x2="76" y2="166" stroke="#1e293b" strokeWidth="1.8" />
          <line x1="90" y1="131" x2="90" y2="167" stroke="#1e293b" strokeWidth="1.8" />
          <line x1="100" y1="132" x2="104" y2="166" stroke="#1e293b" strokeWidth="1.8" />
          <line x1="112" y1="133" x2="118" y2="165" stroke="#1e293b" strokeWidth="1.8" />

          {/* スカート裾の白ライン（セーラー風） */}
          <path
            d="M52 160 C76 163 104 163 128 160"
            stroke="#ffffff"
            strokeWidth="2.2"
            fill="none"
            opacity="0.9"
          />

          {/* ウエストの細ベルト＆ゴールドバックル */}
          <path d="M58 134 Q90 131 122 134" stroke="#451e08" strokeWidth="3" strokeLinecap="round" />
          <rect x="86" y="131" width="8" height="5" rx="1.5" fill="#facc15" stroke="#1a2436" strokeWidth="1" />
        </g>

        {/* 10. 上半身・制服ブラウスとベスト */}
        <g>
          {/* ブラウス身頃 */}
          <path
            d="M54 100 C54 92 68 89 90 89 C112 89 126 92 126 100 L124 135 C112 137 100 137 90 137 C80 137 68 137 56 135 Z"
            fill={
              clothes === "clothes_tshirt"
                ? "#f8fafc"
                : clothes === "clothes_safari"
                ? "#d97706"
                : clothes === "clothes_hoodie"
                ? "#f472b6"
                : "url(#girlUniformGrad)"
            }
            stroke="#1a2436"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* 白い丸襟ブラウス（ピーターパンカラー） */}
          <path
            d="M74 90 C70 98 80 105 90 102 C100 105 110 98 106 90 Z"
            fill="#ffffff"
            stroke="#1a2436"
            strokeWidth="1.8"
          />

          {/* ベストのVネックライン＆金ボタン */}
          {clothes === "clothes_school" && (
            <g>
              <polygon points="76,92 90,112 104,92" fill="#ffffff" stroke="#1a2436" strokeWidth="1.4" />
              <circle cx="90" cy="120" r="2.5" fill="#facc15" stroke="#1a2436" strokeWidth="1" />
              <circle cx="90" cy="128" r="2.5" fill="#facc15" stroke="#1a2436" strokeWidth="1" />
            </g>
          )}

          {/* 胸元の愛らしく大きなコーラルピンクリボンタイ！ */}
          <g>
            {/* 左の羽 */}
            <path
              d="M90 98 C82 92 70 94 72 103 C74 110 85 106 90 100 Z"
              fill="url(#girlRibbonGrad)"
              stroke="#1a2436"
              strokeWidth="2"
            />
            {/* 右の羽 */}
            <path
              d="M90 98 C98 92 110 94 108 103 C106 110 95 106 90 100 Z"
              fill="url(#girlRibbonGrad)"
              stroke="#1a2436"
              strokeWidth="2"
            />
            {/* 下に垂れるリボンの裾 */}
            <path
              d="M87 101 L82 116 L88 113 L90 104 Z"
              fill="#be123c"
              stroke="#1a2436"
              strokeWidth="1.5"
            />
            <path
              d="M93 101 L98 116 L92 113 L90 104 Z"
              fill="#be123c"
              stroke="#1a2436"
              strokeWidth="1.5"
            />
            {/* 中央のふっくら結び目 */}
            <ellipse cx="90" cy="99" rx="4.2" ry="3.8" fill="#ff4d79" stroke="#1a2436" strokeWidth="1.8" />
            <circle cx="90" cy="99" r="1.5" fill="#fff" opacity="0.6" />
          </g>
        </g>

        {/* 11. 首とあごの落ち影 */}
        <rect x="84" y="78" width="12" height="15" rx="5" fill="#fcd9c2" stroke="#1a2436" strokeWidth="2" />
        <ellipse cx="90" cy="80" rx="8" ry="3" fill="#f5be9e" opacity="0.6" />

        {/* 12. 耳 */}
        <g>
          <circle cx="51" cy="62" r="7.5" fill="#f7d5be" stroke="#1a2436" strokeWidth="2" />
          <path d="M51 59 Q49 62 52 65" stroke="#7c4322" strokeWidth="1.2" fill="none" />
          <circle cx="129" cy="62" r="7.5" fill="#f7d5be" stroke="#1a2436" strokeWidth="2" />
          <path d="M129 59 Q131 62 128 65" stroke="#7c4322" strokeWidth="1.2" fill="none" />
        </g>

        {/* 13. 美しい顔の輪郭（ふっくら愛らしいアニメフェイス） */}
        <path
          d="M53 52 C53 32 68 24 90 24 C112 24 127 32 127 52 C127 68 120 79 107 88 C99 93 94 95 90 95 C86 95 81 93 73 88 C60 79 53 68 53 52 Z"
          fill="url(#girlSkinGrad)"
          stroke="#1a2436"
          strokeWidth="3"
        />

        {/* 天使の輪（前髪ハイライト） */}
        <ellipse cx="90" cy="36" rx="30" ry="7" fill="url(#girlHaloGrad)" />

        {/* 14. 前髪（束感と透け感のある愛らしいアニメバング） */}
        <path
          d="M52 56 C54 30 71 22 90 22 C109 22 126 30 128 56 C122 43 114 38 106 48 C101 41 94 40 90 49 C86 40 79 41 74 48 C66 38 58 43 52 56 Z"
          fill="url(#girlHairGrad)"
          stroke="#1a2436"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* サイドの姫毛（輪郭に沿う可愛いカール束） */}
        <path
          d="M54 54 C51 66 52 75 56 82 C53 75 52 66 54 54 Z"
          fill="url(#girlHairGrad)"
          stroke="#1a2436"
          strokeWidth="2"
        />
        <path
          d="M126 54 C129 66 128 75 124 82 C127 75 128 66 126 54 Z"
          fill="url(#girlHairGrad)"
          stroke="#1a2436"
          strokeWidth="2"
        />

        {/* 頭頂のぴょこんと揺れるアホ毛 */}
        <path
          d="M91 21 C93 6 109 8 113 15 C105 15 98 18 94 23 Z"
          fill="url(#girlHairGrad)"
          stroke="#1a2436"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* 女の子の可愛いミントグリーンヘアピン */}
        <rect
          x="63"
          y="37"
          width="10"
          height="3.2"
          rx="1.6"
          fill="#2dd4bf"
          stroke="#1a2436"
          strokeWidth="1.2"
          transform="rotate(-22 63 37)"
        />

        {/* レベルに応じた成長アクセサリー（クリップ/ブローチ） */}
        {level === 1 && (
          /* 若葉のミニクリップ */
          <g transform="translate(112, 33)">
            <ellipse cx="0" cy="0" rx="3.5" ry="2" fill="#84cc16" stroke="#1a2436" strokeWidth="1" transform="rotate(-30)" />
          </g>
        )}
        {level >= 2 && level < 4 && (
          /* 四つ葉のクローバーピン */
          <g transform="translate(114, 34)">
            <circle cx="-2" cy="-2" r="2.5" fill="#4ade80" />
            <circle cx="2" cy="-2" r="2.5" fill="#4ade80" />
            <circle cx="-2" cy="2" r="2.5" fill="#4ade80" />
            <circle cx="2" cy="2" r="2.5" fill="#4ade80" />
            <circle cx="0" cy="0" r="1.2" fill="#facc15" />
          </g>
        )}
        {level >= 4 && (
          /* 満開の桜コサージュ */
          <g transform="translate(116, 35)">
            <circle cx="0" cy="0" r="5" fill="#f472b6" stroke="#1a2436" strokeWidth="1" />
            <circle cx="0" cy="0" r="2" fill="#facc15" />
          </g>
        )}

        {/* 15. ほんのり桜色チーク＆照れ線 */}
        <ellipse cx="64" cy="71" rx="9" ry="6" fill="#ff7694" opacity="0.6" />
        <line x1="61" y1="73" x2="64.5" y2="68" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="65.5" y1="73" x2="69" y2="68" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />

        <ellipse cx="116" cy="71" rx="9" ry="6" fill="#ff7694" opacity="0.6" />
        <line x1="113" y1="73" x2="116.5" y2="68" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="117.5" y1="73" x2="121" y2="68" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />

        {/* 小さな愛らしい点鼻 */}
        <circle cx="90" cy="68" r="1" fill="#e09e7d" />
        <circle cx="89.5" cy="67.5" r="0.5" fill="#ffffff" />

        {/* 16. 表情：うるうる大きなアニメ瞳と笑顔の口 */}
        {blink ? (
          /* まばたき（愛らしい笑顔の伏せ目） */
          <g>
            <path d="M64 65 Q73 58 82 65" stroke="#1a2436" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path d="M81 64 L85 61" stroke="#1a2436" strokeWidth="2.2" strokeLinecap="round" />

            <path d="M98 65 Q107 58 116 65" stroke="#1a2436" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path d="M115 61 L119 64" stroke="#1a2436" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ) : (
          /* パッチリ開いた最高峰のアニメ瞳！ */
          <g>
            {/* 左目 */}
            {/* 白目ベース */}
            <ellipse cx="73" cy="64" rx="9" ry="12" fill="#ffffff" stroke="#1a2436" strokeWidth="2.2" />
            {/* 虹彩グラデーション */}
            <ellipse cx="73" cy="64.5" rx="7.5" ry="10.5" fill="url(#girlEyeGrad)" />
            {/* 瞳孔（ディープコア） */}
            <ellipse cx="73" cy="63" rx="3.6" ry="5" fill="#0b172a" />
            {/* 下部三日月エメラルド光 */}
            <path d="M68 68 Q73 73 78 68 Q73 70.5 68 68 Z" fill="#67e8f9" />
            {/* 大きな主光ハイライト（左上） */}
            <circle cx="70" cy="59" r="3.4" fill="#ffffff" />
            {/* 小さなきらめき星屑ハイライト（右下） */}
            <circle cx="76" cy="69" r="1.4" fill="#ffffff" />
            {/* 濃密で美しい上アイライン＆目尻まつ毛 */}
            <path d="M63 62 Q73 53 83 61" stroke="#1a2436" strokeWidth="3.8" strokeLinecap="round" fill="none" />
            <path d="M82 60 L87 56" stroke="#1a2436" strokeWidth="2.5" strokeLinecap="round" />
            {/* 繊細な二重ライン */}
            <path d="M65 55 Q73 51 81 55" stroke="rgba(26, 36, 54, 0.45)" strokeWidth="1.4" fill="none" />

            {/* 右目 */}
            <ellipse cx="107" cy="64" rx="9" ry="12" fill="#ffffff" stroke="#1a2436" strokeWidth="2.2" />
            <ellipse cx="107" cy="64.5" rx="7.5" ry="10.5" fill="url(#girlEyeGrad)" />
            <ellipse cx="107" cy="63" rx="3.6" ry="5" fill="#0b172a" />
            <path d="M102 68 Q107 73 112 68 Q107 70.5 102 68 Z" fill="#67e8f9" />
            <circle cx="104" cy="59" r="3.4" fill="#ffffff" />
            <circle cx="110" cy="69" r="1.4" fill="#ffffff" />
            <path d="M97 61 Q107 53 117 62" stroke="#1a2436" strokeWidth="3.8" strokeLinecap="round" fill="none" />
            <path d="M116 56 L121 60" stroke="#1a2436" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M99 55 Q107 51 115 55" stroke="rgba(26, 36, 54, 0.45)" strokeWidth="1.4" fill="none" />
          </g>
        )}

        {/* やわらかなアーチ眉 */}
        {mood === "think" ? (
          <g>
            <path d="M65 52 Q73 47 81 51" stroke="#542810" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <path d="M99 49 Q107 46 115 52" stroke="#542810" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          <g>
            <path d="M64 51 Q73 46 82 50" stroke="#542810" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <path d="M98 50 Q107 46 116 51" stroke="#542810" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* 口（笑顔・表情） */}
        {mood === "celebrate" ? (
          /* 大喜びの開いた口（白い歯とピンクの舌） */
          <g>
            <path d="M82 72 Q90 87 98 72 Z" fill="#be123c" stroke="#1a2436" strokeWidth="2.2" />
            <path d="M84 73 L96 73 L96 75 L84 75 Z" fill="#ffffff" />
            <path d="M85 79 Q90 75 95 79 Q90 85 85 79 Z" fill="#fb7185" />
          </g>
        ) : mood === "think" ? (
          /* 考え中のおちょぼ口 */
          <ellipse cx="90" cy="74" rx="3.2" ry="4" fill="#1a2436" />
        ) : (
          /* にっこり愛らしい笑顔 */
          <g>
            <path d="M83 72 Q90 80 97 72" stroke="#1a2436" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="90" cy="76" rx="4" ry="1.5" fill="#f43f5e" opacity="0.6" />
          </g>
        )}

        {/* 17. めがね（装備時のみ） */}
        {glasses === "glasses_round" && (
          <g>
            <circle cx="73" cy="64" r="13" fill="none" stroke="#d97706" strokeWidth="2.5" />
            <circle cx="107" cy="64" r="13" fill="none" stroke="#d97706" strokeWidth="2.5" />
            <path d="M86 64 Q90 62 94 64" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M65 55 L70 51" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="2" strokeLinecap="round" />
            <path d="M99 55 L104 51" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {glasses === "glasses_star" && (
          <g transform="translate(90, 64)">
            <polygon
              points="-17,-9 -13,-3 -8,-3 -12,2 -10,8 -17,4 -24,8 -22,2 -26,-3 -21,-3"
              fill="none"
              stroke="#facc15"
              strokeWidth="2.5"
            />
            <polygon
              points="17,-9 21,-3 26,-3 22,2 24,8 17,4 10,8 12,2 8,-3 13,-3"
              fill="none"
              stroke="#facc15"
              strokeWidth="2.5"
            />
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#facc15" strokeWidth="2.5" />
          </g>
        )}

        {/* 18. 腕と手（女の子らしい繊細なポーズと指先） */}
        {mood === "celebrate" ? (
          /* お祝いバンザイポーズ */
          <g>
            {/* 左腕 */}
            <path d="M54 102 Q34 80 30 58" stroke="#1a2b47" strokeWidth="9" strokeLinecap="round" fill="none" />
            <circle
              cx="30"
              cy="56"
              r="6.5"
              fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
              stroke="#1a2436"
              strokeWidth="2.2"
            />

            {/* 右腕 */}
            <path d="M126 102 Q146 80 150 58" stroke="#1a2b47" strokeWidth="9" strokeLinecap="round" fill="none" />
            <circle
              cx="150"
              cy="56"
              r="6.5"
              fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
              stroke="#1a2436"
              strokeWidth="2.2"
            />
          </g>
        ) : mood === "think" ? (
          /* 考え中：片手をあごに添える仕草 */
          <g>
            {/* 右手があごへ */}
            <path d="M124 104 Q132 86 104 76" stroke="#1a2b47" strokeWidth="8" strokeLinecap="round" fill="none" />
            <circle
              cx="103"
              cy="75"
              r="6"
              fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
              stroke="#1a2436"
              strokeWidth="2"
            />
            {/* 左腕は腰に */}
            <path d="M56 104 Q48 120 74 122" stroke="#1a2b47" strokeWidth="8" strokeLinecap="round" fill="none" />
            <circle
              cx="75"
              cy="122"
              r="6"
              fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
              stroke="#1a2436"
              strokeWidth="2"
            />
          </g>
        ) : (
          /* 通常立ち姿：胸の前で両手をきゅっと重ねる、お行儀良く愛らしい女の子ポーズ */
          <g>
            {/* 左腕・袖 */}
            <path
              d="M54 102 Q44 116 74 114"
              stroke="#1a2b47"
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
            />
            {/* 右腕・袖 */}
            <path
              d="M126 102 Q136 116 106 114"
              stroke="#1a2b47"
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
            />

            {/* 左手（指先まで丁寧に描写） */}
            <g transform="translate(72, 108)">
              <rect
                x="0"
                y="0"
                width="13"
                height="11"
                rx="4.5"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
                stroke="#1a2436"
                strokeWidth="2"
              />
              <path
                d="M10 2 C13 0 15 4 12 6 Z"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
                stroke="#1a2436"
                strokeWidth="1.5"
              />
              <line x1="4" y1="10" x2="4" y2="13" stroke="#542810" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="7" y1="10" x2="7" y2="14" stroke="#542810" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="10" y1="10" x2="10" y2="13" stroke="#542810" strokeWidth="1.2" strokeLinecap="round" />
            </g>

            {/* 右手 */}
            <g transform="translate(95, 108)">
              <rect
                x="0"
                y="0"
                width="13"
                height="11"
                rx="4.5"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
                stroke="#1a2436"
                strokeWidth="2"
              />
              <path
                d="M3 2 C0 0 -2 4 1 6 Z"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#feeddd"}
                stroke="#1a2436"
                strokeWidth="1.5"
              />
              <line x1="3" y1="10" x2="3" y2="13" stroke="#542810" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="6" y1="10" x2="6" y2="14" stroke="#542810" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="9" y1="10" x2="9" y2="13" stroke="#542810" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          </g>
        )}

        {/* 19. 着せ替え帽子アクセサリ */}
        {hat === "hat_safari" && (
          <g transform="translate(90, 20)">
            <ellipse cx="0" cy="5" rx="42" ry="8" fill="#d4a373" stroke="#1a2436" strokeWidth="2.2" />
            <path d="M-26 5 C-24 -16 24 -16 26 5 Z" fill="#d4a373" stroke="#1a2436" strokeWidth="2.2" />
            <rect x="-26" y="0" width="52" height="5" fill="#582f0e" />
          </g>
        )}
        {hat === "hat_beret" && (
          <g transform="translate(98, 18) rotate(12)">
            <ellipse cx="0" cy="0" rx="32" ry="14" fill="#dc2626" stroke="#1a2436" strokeWidth="2.2" />
            <line x1="0" y1="-14" x2="2" y2="-20" stroke="#1a2436" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        {hat === "hat_ribbon" && (
          <g transform="translate(114, 24) rotate(15)">
            <ellipse cx="-10" cy="0" rx="11" ry="6" fill="#ff6584" stroke="#1a2436" strokeWidth="2" />
            <ellipse cx="10" cy="0" rx="11" ry="6" fill="#ff6584" stroke="#1a2436" strokeWidth="2" />
            <circle cx="0" cy="0" r="5" fill="#e11d48" stroke="#1a2436" strokeWidth="2" />
          </g>
        )}
        {hat === "hat_wizard" && (
          <g transform="translate(90, 18)">
            <ellipse cx="0" cy="5" rx="38" ry="6.5" fill="#6b21a8" stroke="#1a2436" strokeWidth="2.2" />
            <path d="M-24 5 L6 -34 L24 5 Z" fill="#6b21a8" stroke="#1a2436" strokeWidth="2.2" />
            <polygon points="6,-36 8,-32 12,-32 9,-29 10,-25 6,-27 2,-25 3,-29 0,-32 4,-32" fill="#facc15" />
          </g>
        )}
        {hat === "hat_crown" && (
          <g transform="translate(90, 20)">
            <path d="M-22 3 L-20 -12 L-10 -4 L0 -16 L10 -4 L20 -12 L22 3 Z" fill="#f59e0b" stroke="#1a2436" strokeWidth="2.2" />
            <circle cx="-20" cy="-12" r="2" fill="#ef4444" />
            <circle cx="0" cy="-16" r="2.8" fill="#3b82f6" />
            <circle cx="20" cy="-12" r="2" fill="#ef4444" />
          </g>
        )}
      </svg>
    </div>
  );
}
