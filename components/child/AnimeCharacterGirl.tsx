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
 * 添付画像（名探偵コナン風ちびキャラ）の女の子バージョン（かのはちゃん）
 * くっきりとした黒のアウトライン、セルアニメ塗り、生き生きとした表情と仕草を完全再現。
 */
export function AnimeCharacterGirl({
  mood = "happy",
  level = 1,
  accessories,
  className,
  onClick,
}: AnimeCharacterGirlProps) {
  const [blink, setBlink] = useState(false);

  // 自然なアニメ調まばたきループ
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const triggerBlink = () => {
      setBlink(true);
      setTimeout(() => {
        setBlink(false);
        const nextBlinkTime = 2500 + Math.random() * 3000;
        timeoutId = setTimeout(triggerBlink, nextBlinkTime);
      }, 140);
    };

    timeoutId = setTimeout(triggerBlink, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  const clothes = accessories?.clothes || "clothes_school";
  const hat = accessories?.hat || "hat_none";
  // デフォルトでコナン丸メガネをオン（着せ替え指定がある場合はそれに従う）
  const glasses = accessories?.glasses ?? "glasses_round";
  const gloves = accessories?.gloves || "gloves_none";

  return (
    <div
      className={`${styles.animeGirlContainer} ${className || ""}`}
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
        viewBox="0 0 160 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
          filter: "drop-shadow(0 6px 12px rgba(16, 24, 40, 0.12))",
        }}
        className={mood === "celebrate" ? styles.celebrateJump : styles.idleBreath}
      >
        <defs>
          {/* 髪色パレット（添付画像からサンプリング） */}
          <linearGradient id="c_hairGrad" x1="50" y1="20" x2="110" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9a5832" />
            <stop offset="60%" stopColor="#733c1f" />
            <stop offset="100%" stopColor="#4e2511" />
          </linearGradient>

          {/* 肌色パレット */}
          <linearGradient id="c_skinGrad" x1="60" y1="40" x2="100" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff2e2" />
            <stop offset="100%" stopColor="#f8d6be" />
          </linearGradient>

          {/* 添付画像のコナンロイヤルブルーブレザー */}
          <linearGradient id="c_blazerGrad" x1="40" y1="95" x2="120" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1a56ad" />
            <stop offset="50%" stopColor="#12418a" />
            <stop offset="100%" stopColor="#0a2a60" />
          </linearGradient>

          {/* 瞳のコバルトブルーグラデーション */}
          <linearGradient id="c_eyeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#08142c" />
            <stop offset="40%" stopColor="#0369a1" />
            <stop offset="75%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* 赤い蝶ネクタイリボングラデーション */}
          <linearGradient id="c_bowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="60%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>

          {/* スニーカーレッド */}
          <linearGradient id="c_sneakerRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>

          {/* グレースカート */}
          <linearGradient id="c_skirtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#78849b" />
            <stop offset="100%" stopColor="#535d70" />
          </linearGradient>

          {/* 天使の輪（髪ハイライト） */}
          <linearGradient id="c_haloGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255, 235, 215, 0)" />
            <stop offset="50%" stopColor="rgba(255, 245, 225, 0.9)" />
            <stop offset="100%" stopColor="rgba(255, 235, 215, 0)" />
          </linearGradient>
        </defs>

        {/* 1. 地面のソフトシャドウ */}
        <ellipse cx="80" cy="210" rx="44" ry="5.5" fill="rgba(16, 32, 60, 0.2)" />

        {/* 2. 勇者の赤いマント（着せ替え時） */}
        {clothes === "clothes_hero" && (
          <path
            d="M40 106 L80 96 L120 106 L128 184 L32 184 Z"
            fill="#dc2626"
            stroke="#991b1b"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}

        {/* 3. 脚（太もも・すね：健康的なアニメ白肌） */}
        {/* 左脚 */}
        <rect
          x="59"
          y="150"
          width="17"
          height="25"
          rx="8.5"
          fill="url(#c_skinGrad)"
          stroke="#16243b"
          strokeWidth="2.2"
        />
        {/* 膝の影・丸み */}
        <ellipse cx="67.5" cy="160" rx="4" ry="2.5" fill="#f4c29c" />

        {/* 右脚 */}
        <rect
          x="84"
          y="150"
          width="17"
          height="25"
          rx="8.5"
          fill="url(#c_skinGrad)"
          stroke="#16243b"
          strokeWidth="2.2"
        />
        <ellipse cx="92.5" cy="160" rx="4" ry="2.5" fill="#f4c29c" />

        {/* 4. 白いクルーソックス（添付画像と完全同一の折り返しカフスリブ！） */}
        {/* 左ソックス */}
        <g>
          {/* ソックス本体 */}
          <rect
            x="59"
            y="167"
            width="17"
            height="23"
            rx="5"
            fill="#ffffff"
            stroke="#16243b"
            strokeWidth="2.2"
          />
          <path d="M60 178 L75 178 L75 188 L60 188 Z" fill="#e2e8f0" opacity="0.4" />
          {/* 折り返しリブカフス（ふっくらした立体感） */}
          <rect
            x="57"
            y="165"
            width="21"
            height="7.5"
            rx="3.75"
            fill="#ffffff"
            stroke="#16243b"
            strokeWidth="2.2"
          />
          <line x1="61" y1="168.5" x2="74" y2="168.5" stroke="#cbd5e1" strokeWidth="1" />
        </g>

        {/* 右ソックス */}
        <g>
          <rect
            x="84"
            y="167"
            width="17"
            height="23"
            rx="5"
            fill="#ffffff"
            stroke="#16243b"
            strokeWidth="2.2"
          />
          <path d="M85 178 L100 178 L100 188 L85 188 Z" fill="#e2e8f0" opacity="0.4" />
          <rect
            x="82"
            y="165"
            width="21"
            height="7.5"
            rx="3.75"
            fill="#ffffff"
            stroke="#16243b"
            strokeWidth="2.2"
          />
          <line x1="86" y1="168.5" x2="99" y2="168.5" stroke="#cbd5e1" strokeWidth="1" />
        </g>

        {/* 5. 添付画像と寸分違わぬ赤×白のコナン風スニーカー */}
        {/* 左足スニーカー */}
        <g transform="translate(51, 187)">
          {/* 厚底ホワイトソール（影付き） */}
          <rect x="0" y="11" width="31" height="7.5" rx="3.5" fill="#e2e8f0" stroke="#16243b" strokeWidth="2.2" />
          <rect x="0" y="11" width="31" height="5.5" rx="2.8" fill="#ffffff" />

          {/* 赤いサイドパネルアッパー */}
          <path
            d="M3 4 C3 4 12 1 20 4 C24 6 26 10 26 12 L3 12 Z"
            fill={clothes === "clothes_school" ? "url(#c_sneakerRed)" : "#ef4444"}
            stroke="#16243b"
            strokeWidth="2.2"
          />

          {/* 白いトゥキャップ（つま先カップ） */}
          <path
            d="M20 5 C23 7 28 8 28 12 L19 12 Z"
            fill="#ffffff"
            stroke="#16243b"
            strokeWidth="1.8"
          />

          {/* 白いベルクロストラップ（横帯） */}
          <rect x="8" y="5.5" width="10" height="3.5" rx="1.5" fill="#ffffff" stroke="#16243b" strokeWidth="1.4" />

          {/* 踵の白ヒールカウンター */}
          <path d="M3 5 C3 5 5 10 5 12 L1 12 C1 10 2 6 3 5 Z" fill="#ffffff" />
        </g>

        {/* 右足スニーカー */}
        <g transform="translate(80, 187)">
          <rect x="0" y="11" width="31" height="7.5" rx="3.5" fill="#e2e8f0" stroke="#16243b" strokeWidth="2.2" />
          <rect x="0" y="11" width="31" height="5.5" rx="2.8" fill="#ffffff" />

          <path
            d="M3 4 C3 4 12 1 20 4 C24 6 26 10 26 12 L3 12 Z"
            fill={clothes === "clothes_school" ? "url(#c_sneakerRed)" : "#ef4444"}
            stroke="#16243b"
            strokeWidth="2.2"
          />

          <path
            d="M20 5 C23 7 28 8 28 12 L19 12 Z"
            fill="#ffffff"
            stroke="#16243b"
            strokeWidth="1.8"
          />

          <rect x="8" y="5.5" width="10" height="3.5" rx="1.5" fill="#ffffff" stroke="#16243b" strokeWidth="1.4" />
          <path d="M3 5 C3 5 5 10 5 12 L1 12 C1 10 2 6 3 5 Z" fill="#ffffff" />
        </g>

        {/* 6. グレーのプリーツスカート（添付画像グレーショーツの女の子バージョン） */}
        <g>
          {/* スカートベース */}
          <path
            d="M48 128 C48 128 62 125 80 125 C98 125 112 128 112 128 L118 156 C105 158 80 158 42 156 Z"
            fill="url(#c_skirtGrad)"
            stroke="#16243b"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />

          {/* プリーツひだの陰影ライン */}
          <line x1="58" y1="127" x2="54" y2="156" stroke="#363e4d" strokeWidth="1.8" />
          <line x1="69" y1="126" x2="67" y2="157" stroke="#363e4d" strokeWidth="1.8" />
          <line x1="80" y1="125" x2="80" y2="157" stroke="#363e4d" strokeWidth="1.8" />
          <line x1="91" y1="126" x2="93" y2="157" stroke="#363e4d" strokeWidth="1.8" />
          <line x1="102" y1="127" x2="106" y2="156" stroke="#363e4d" strokeWidth="1.8" />

          {/* ウエストベルト＆ゴールドバックル */}
          <path d="M50 128 Q80 125 110 128" stroke="#372016" strokeWidth="3" strokeLinecap="round" />
          <rect x="76" y="125" width="8" height="5.5" rx="1.5" fill="#facc15" stroke="#16243b" strokeWidth="1.2" />
        </g>

        {/* 7. 後ろ髪（女の子らしいふんわりカールボブ） */}
        <circle cx="80" cy="56" r="39" fill="url(#c_hairGrad)" stroke="#16243b" strokeWidth="2.5" />

        {/* 女の子のサイドツインテール（左右のふんわりカール束） */}
        {/* 左ツインテール */}
        <g transform="translate(34, 54)">
          {/* ピンクリボン髪留めゴム */}
          <ellipse cx="8" cy="8" rx="5.5" ry="3.5" fill="#ff4d6d" stroke="#16243b" strokeWidth="1.2" />
          {/* ふんわりカール毛束 */}
          <path
            d="M8 10 C-4 22 -12 36 -2 50 C6 38 12 28 10 12 Z"
            fill="url(#c_hairGrad)"
            stroke="#16243b"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </g>
        {/* 右ツインテール */}
        <g transform="translate(118, 54)">
          <ellipse cx="8" cy="8" rx="5.5" ry="3.5" fill="#ff4d6d" stroke="#16243b" strokeWidth="1.2" />
          <path
            d="M8 10 C20 22 28 36 18 50 C10 38 4 28 6 12 Z"
            fill="url(#c_hairGrad)"
            stroke="#16243b"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </g>

        {/* 頭頂のアホ毛（添付画像とおそろい！） */}
        <path
          d="M81 20 C83 6 97 8 101 14 C94 14 88 17 84 22 Z"
          fill="url(#c_hairGrad)"
          stroke="#16243b"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* 8. ロイヤルブルーのブレザー制服（添付画像と完全同一デザイン！） */}
        <g>
          {/* ブレザー身頃 */}
          <path
            d="M46 96 C46 88 60 86 80 86 C100 86 114 88 114 96 L112 128 C100 130 90 130 80 130 C70 130 60 130 48 128 Z"
            fill="url(#c_blazerGrad)"
            stroke="#16243b"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* 白いカッターシャツの三角襟（ラペル奥） */}
          <polygon points="70,86 80,98 90,86" fill="#ffffff" stroke="#16243b" strokeWidth="1.5" />

          {/* ブレザーのラペル襟（白いパイピング付き！） */}
          {/* 左ラペル */}
          <path
            d="M62 88 L74 104 L66 114 L56 94 Z"
            fill="#12418a"
            stroke="#16243b"
            strokeWidth="1.8"
          />
          {/* 白いパイピングライン */}
          <path d="M62 88 L74 104 L66 114" stroke="#ffffff" strokeWidth="1.4" fill="none" />

          {/* 右ラペル */}
          <path
            d="M98 88 L86 104 L94 114 L104 94 Z"
            fill="#12418a"
            stroke="#16243b"
            strokeWidth="1.8"
          />
          <path d="M98 88 L86 104 L94 114" stroke="#ffffff" strokeWidth="1.4" fill="none" />

          {/* 前合わせの金ボタン */}
          <circle cx="80" cy="116" r="2.8" fill="#facc15" stroke="#16243b" strokeWidth="1.2" />

          {/* 象徴的なふっくら真っ赤な蝶ネクタイ（リボン）！ */}
          <g>
            {/* 左羽 */}
            <path
              d="M80 94 C76 89 66 88 68 96 C69 101 77 98 80 95 Z"
              fill="url(#c_bowGrad)"
              stroke="#16243b"
              strokeWidth="2"
            />
            {/* 右羽 */}
            <path
              d="M80 94 C84 89 94 88 92 96 C91 101 83 98 80 95 Z"
              fill="url(#c_bowGrad)"
              stroke="#16243b"
              strokeWidth="2"
            />
            {/* 中央結び目 */}
            <ellipse cx="80" cy="94.5" rx="3.8" ry="3.5" fill="#ef4444" stroke="#16243b" strokeWidth="1.8" />
          </g>
        </g>

        {/* 9. 首と僧帽筋 */}
        <rect x="74" y="74" width="12" height="15" rx="5" fill="#ffd8c0" stroke="#16243b" strokeWidth="2" />

        {/* 10. 耳（くっきりした黒枠＋内側の影） */}
        <g>
          <circle cx="44" cy="58" r="8" fill="#f8d6be" stroke="#16243b" strokeWidth="2.2" />
          <path d="M44 55 Q42 58 45 61" stroke="#4e2511" strokeWidth="1.4" fill="none" />

          <circle cx="116" cy="58" r="8" fill="#f8d6be" stroke="#16243b" strokeWidth="2.2" />
          <path d="M116 55 Q118 58 115 61" stroke="#4e2511" strokeWidth="1.4" fill="none" />
        </g>

        {/* 11. 顔の輪郭（卵型・キュッと引き締まった顎） */}
        <path
          d="M47 50 C47 32 61 24 80 24 C99 24 113 32 113 50 C113 65 107 75 95 84 C89 89 84 91 80 91 C76 91 71 89 65 84 C53 75 47 65 47 50 Z"
          fill="url(#c_skinGrad)"
          stroke="#16243b"
          strokeWidth="3.2"
        />

        {/* 天使の輪（髪ハイライト） */}
        <ellipse cx="80" cy="35" rx="28" ry="6" fill="url(#c_haloGrad)" opacity="0.9" />

        {/* 前髪（ふんわり束感のあるM字バング & 姫毛） */}
        <path
          d="M46 54 C48 30 63 22 80 22 C97 22 112 30 114 54 C109 42 101 37 94 46 C90 39 84 38 80 47 C76 38 70 39 66 46 C59 37 51 42 46 54 Z"
          fill="url(#c_hairGrad)"
          stroke="#16243b"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* サイド姫毛 */}
        <path d="M47 52 C45 62 46 70 49 76 C47 70 46 62 47 52 Z" fill="url(#c_hairGrad)" stroke="#16243b" strokeWidth="1.8" />
        <path d="M113 52 C115 62 114 70 111 76 C113 70 114 62 113 52 Z" fill="url(#c_hairGrad)" stroke="#16243b" strokeWidth="1.8" />

        {/* 女の子の可愛いミントグリーンヘアピン */}
        <rect
          x="56"
          y="35"
          width="9"
          height="3"
          rx="1.4"
          fill="#2dd4bf"
          stroke="#16243b"
          strokeWidth="1.2"
          transform="rotate(-20 56 35)"
        />

        {/* ほっぺ（アニメふんわりチーク＋照れ線） */}
        <ellipse cx="57" cy="67" rx="8" ry="5.5" fill="#ff7694" opacity="0.65" />
        <line x1="54" y1="69" x2="57.5" y2="64" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="58.5" y1="69" x2="62" y2="64" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />

        <ellipse cx="103" cy="67" rx="8" ry="5.5" fill="#ff7694" opacity="0.65" />
        <line x1="100" y1="69" x2="103.5" y2="64" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="104.5" y1="69" x2="108" y2="64" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />

        {/* ちょこんとしたアニメ鼻 */}
        <polygon points="80,63 81.5,66.5 78.5,66.5" fill="#f0bba0" />
        <circle cx="79.5" cy="64" r="0.8" fill="#ffffff" />

        {/* 12. 表情（うるうる大きな青い瞳 & にっこり笑顔のお口） */}
        {blink ? (
          /* まばたき（閉じた愛らしい笑顔目） */
          <g>
            <path d="M57 62 Q65 56 73 62" stroke="#16243b" strokeWidth="3.2" strokeLinecap="round" fill="none" />
            <path d="M72 61 L76 58" stroke="#16243b" strokeWidth="2.2" strokeLinecap="round" />

            <path d="M87 62 Q95 56 103 62" stroke="#16243b" strokeWidth="3.2" strokeLinecap="round" fill="none" />
            <path d="M102 58 L106 61" stroke="#16243b" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ) : (
          /* ぱっちり開いた添付画像とおそろいのアニメ瞳！ */
          <g>
            {/* 左目 */}
            {/* 白目 */}
            <ellipse cx="65" cy="61" rx="8" ry="11" fill="#ffffff" stroke="#16243b" strokeWidth="2.2" />
            {/* 虹彩グラデーション */}
            <ellipse cx="65" cy="61.5" rx="6.5" ry="9.5" fill="url(#c_eyeGrad)" />
            {/* 瞳孔（黒コア） */}
            <ellipse cx="65" cy="60" rx="3.2" ry="4.5" fill="#060d1a" />
            {/* 大きな純白丸ハイライト（左上） */}
            <circle cx="62.5" cy="57" r="3" fill="#ffffff" />
            {/* 下部の三日月ルミナス光 */}
            <path d="M61 65 Q65 69 69 65 Q65 67 61 65 Z" fill="#7dd3fc" />
            {/* 右下の小さな星屑ハイライト */}
            <circle cx="67.5" cy="65" r="1.3" fill="#ffffff" />
            {/* 太い上まつ毛アイライン */}
            <path d="M56 59 Q65 51 74 58" stroke="#16243b" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path d="M73 57 L77 54" stroke="#16243b" strokeWidth="2.4" strokeLinecap="round" />
            {/* 二重ライン */}
            <path d="M58 53 Q65 49 72 53" stroke="rgba(22, 36, 59, 0.4)" strokeWidth="1.3" fill="none" />

            {/* 右目 */}
            <ellipse cx="95" cy="61" rx="8" ry="11" fill="#ffffff" stroke="#16243b" strokeWidth="2.2" />
            <ellipse cx="95" cy="61.5" rx="6.5" ry="9.5" fill="url(#c_eyeGrad)" />
            <ellipse cx="95" cy="60" rx="3.2" ry="4.5" fill="#060d1a" />
            <circle cx="92.5" cy="57" r="3" fill="#ffffff" />
            <path d="M91 65 Q95 69 99 65 Q95 67 91 65 Z" fill="#7dd3fc" />
            <circle cx="97.5" cy="65" r="1.3" fill="#ffffff" />
            <path d="M86 58 Q95 51 104 59" stroke="#16243b" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path d="M103 54 L107 57" stroke="#16243b" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M88 53 Q95 49 102 53" stroke="rgba(22, 36, 59, 0.4)" strokeWidth="1.3" fill="none" />
          </g>
        )}

        {/* まゆげ */}
        <path d="M57 49 Q65 45 73 48" stroke="#4e2511" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M87 48 Q95 45 103 49" stroke="#4e2511" strokeWidth="2.4" strokeLinecap="round" fill="none" />

        {/* 口（笑顔） */}
        {mood === "celebrate" ? (
          <g>
            <path d="M72 69 Q80 82 88 69 Z" fill="#991b1b" stroke="#16243b" strokeWidth="2" />
            <path d="M74 70 L86 70 L86 71.5 L74 71.5 Z" fill="#ffffff" />
            <path d="M75 75 Q80 72 85 75 Q80 80 75 75 Z" fill="#fb7185" />
          </g>
        ) : mood === "think" ? (
          <ellipse cx="80" cy="71" rx="3" ry="3.8" fill="#16243b" />
        ) : (
          <g>
            <path d="M74 69 Q80 76 86 69" stroke="#16243b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <ellipse cx="80" cy="73.5" rx="3.5" ry="1.2" fill="#ffa0b5" opacity="0.6" />
          </g>
        )}

        {/* 13. 添付画像の象徴！黒縁の大きな丸メガネ（コナンメガネ） */}
        {(glasses === "glasses_round" || glasses === "glasses_none") && (
          <g>
            {/* 左リム */}
            <circle cx="65" cy="61" r="12" fill="none" stroke="#16243b" strokeWidth="3" />
            {/* 右リム */}
            <circle cx="95" cy="61" r="12" fill="none" stroke="#16243b" strokeWidth="3" />
            {/* ブリッジ */}
            <path d="M77 61 Q80 59 83 61" stroke="#16243b" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* レンズのツヤハイライト */}
            <path d="M58 53 L62 50" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M88 53 L92 50" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        )}
        {glasses === "glasses_star" && (
          <g transform="translate(80, 61)">
            <polygon
              points="-15,-8 -12,-3 -7,-3 -11,1 -9,6 -15,3 -21,6 -19,1 -23,-3 -18,-3"
              fill="none"
              stroke="#facc15"
              strokeWidth="2.4"
            />
            <polygon
              points="15,-8 18,-3 23,-3 19,1 21,6 15,3 9,6 11,1 7,-3 12,-3"
              fill="none"
              stroke="#facc15"
              strokeWidth="2.4"
            />
            <line x1="-7" y1="0" x2="7" y2="0" stroke="#facc15" strokeWidth="2.4" />
          </g>
        )}

        {/* 14. 手と腕（添付画像と100%完全同一：胸元で蝶ネクタイ・ラペルをキュッと握る愛らしいポーズ！） */}
        {mood === "celebrate" ? (
          /* お祝いバンザイポーズ */
          <g>
            {/* 左腕 */}
            <path d="M46 96 Q30 76 26 58" stroke="#12418a" strokeWidth="8" strokeLinecap="round" fill="none" />
            <circle cx="26" cy="56" r="6" fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"} stroke="#16243b" strokeWidth="2" />

            {/* 右腕 */}
            <path d="M114 96 Q130 76 134 58" stroke="#12418a" strokeWidth="8" strokeLinecap="round" fill="none" />
            <circle cx="134" cy="56" r="6" fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"} stroke="#16243b" strokeWidth="2" />
          </g>
        ) : mood === "think" ? (
          /* 考え中ポーズ */
          <g>
            <path d="M112 96 Q120 80 94 72" stroke="#12418a" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="93" cy="71" r="5.5" fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"} stroke="#16243b" strokeWidth="2" />

            <path d="M48 98 Q44 114 68 116" stroke="#12418a" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="69" cy="116" r="5.5" fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"} stroke="#16243b" strokeWidth="2" />
          </g>
        ) : (
          /* 通常立ち姿：添付画像と完全同一！両手を胸元の赤い蝶ネクタイ付近に添えてギュッと握る仕草 */
          <g>
            {/* 左腕・袖（ブレザー生地） */}
            <path
              d="M45 96 Q38 108 65 106"
              stroke="#12418a"
              strokeWidth="8.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* 袖口カフス・金ボタン */}
            <circle cx="58" cy="106" r="1.6" fill="#facc15" stroke="#16243b" strokeWidth="0.8" />

            {/* 右腕・袖 */}
            <path
              d="M115 96 Q122 108 95 106"
              stroke="#12418a"
              strokeWidth="8.5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="102" cy="106" r="1.6" fill="#facc15" stroke="#16243b" strokeWidth="0.8" />

            {/* 左手（母指球＋親指＋握った指先） */}
            <g transform="translate(63, 100)">
              <rect
                x="1"
                y="1"
                width="12"
                height="10"
                rx="4"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"}
                stroke="#16243b"
                strokeWidth="2.2"
              />
              {/* 親指 */}
              <path
                d="M10 2.5 C13 1 15 5 12 7 Z"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"}
                stroke="#16243b"
                strokeWidth="1.6"
              />
              {/* 握られた4本の指先ライン */}
              <line x1="4" y1="9" x2="4" y2="12" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="6.5" y1="9" x2="6.5" y2="13" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="9" y1="9" x2="9" y2="13" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="11.5" y1="9" x2="11.5" y2="12" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
            </g>

            {/* 右手（母指球＋親指＋握った指先） */}
            <g transform="translate(85, 100)">
              <rect
                x="1"
                y="1"
                width="12"
                height="10"
                rx="4"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"}
                stroke="#16243b"
                strokeWidth="2.2"
              />
              <path
                d="M4 2.5 C1 1 -1 5 2 7 Z"
                fill={gloves === "gloves_gold" ? "#facc15" : gloves === "gloves_mitten" ? "#ffffff" : "#f8d6be"}
                stroke="#16243b"
                strokeWidth="1.6"
              />
              <line x1="2.5" y1="9" x2="2.5" y2="12" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="5" y1="9" x2="5" y2="13" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="7.5" y1="9" x2="7.5" y2="13" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="10" y1="9" x2="10" y2="12" stroke="#4e2511" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          </g>
        )}

        {/* 15. 帽子アクセサリ（着せ替え時） */}
        {hat === "hat_safari" && (
          <g transform="translate(80, 20)">
            <ellipse cx="0" cy="5" rx="38" ry="7" fill="#d4a373" stroke="#16243b" strokeWidth="2.2" />
            <path d="M-24 5 C-22 -15 22 -15 24 5 Z" fill="#d4a373" stroke="#16243b" strokeWidth="2.2" />
            <rect x="-24" y="0" width="48" height="5" fill="#582f0e" />
          </g>
        )}
        {hat === "hat_beret" && (
          <g transform="translate(88, 18) rotate(10)">
            <ellipse cx="0" cy="0" rx="30" ry="13" fill="#dc2626" stroke="#16243b" strokeWidth="2.2" />
            <line x1="0" y1="-13" x2="2" y2="-18" stroke="#16243b" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        {hat === "hat_ribbon" && (
          <g transform="translate(102, 24) rotate(15)">
            <ellipse cx="-9" cy="0" rx="10" ry="5.5" fill="#ff6584" stroke="#16243b" strokeWidth="1.8" />
            <ellipse cx="9" cy="0" rx="10" ry="5.5" fill="#ff6584" stroke="#16243b" strokeWidth="1.8" />
            <circle cx="0" cy="0" r="4.8" fill="#e11d48" stroke="#16243b" strokeWidth="1.8" />
          </g>
        )}
        {hat === "hat_wizard" && (
          <g transform="translate(80, 18)">
            <ellipse cx="0" cy="5" rx="36" ry="6" fill="#6b21a8" stroke="#16243b" strokeWidth="2.2" />
            <path d="M-22 5 L6 -32 L22 5 Z" fill="#6b21a8" stroke="#16243b" strokeWidth="2.2" />
            <polygon points="6,-34 8,-30 12,-30 9,-27 10,-23 6,-25 2,-23 3,-27 0,-30 4,-30" fill="#facc15" />
          </g>
        )}
        {hat === "hat_crown" && (
          <g transform="translate(80, 20)">
            <path d="M-20 3 L-18 -11 L-9 -4 L0 -15 L9 -4 L18 -11 L20 3 Z" fill="#f59e0b" stroke="#16243b" strokeWidth="2.2" />
            <circle cx="-18" cy="-11" r="2" fill="#ef4444" />
            <circle cx="0" cy="-15" r="2.5" fill="#3b82f6" />
            <circle cx="18" cy="-11" r="2" fill="#ef4444" />
          </g>
        )}
      </svg>
    </div>
  );
}
