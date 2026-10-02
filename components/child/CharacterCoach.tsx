"use client";

import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { ThreeCharacterCoach } from "./ThreeCharacterCoach";
import {
  getEquippedAccessories,
  type EquippedAccessories,
} from "@/lib/rewards/characterGrowthStore";

export function CharacterCoach({
  message,
  mood = "happy",
}: {
  message: string;
  mood?: "happy" | "think" | "celebrate";
}) {
  const [mounted, setMounted] = useState(false);
  const [use3D, setUse3D] = useState(false);
  const [accessories, setAccessories] = useState<EquippedAccessories>(() => {
    if (typeof window !== "undefined") {
      return getEquippedAccessories();
    }
    return {
      hat: "hat_safari",
      glasses: "glasses_none",
      gloves: "gloves_mitten",
      clothes: "clothes_tshirt",
    };
  });

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setUse3D(Boolean(gl));
    } catch {
      setUse3D(false);
    }

    const handleAccessoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<EquippedAccessories>;
      if (customEvent.detail) {
        setAccessories(customEvent.detail);
      }
    };
    window.addEventListener("kanoha-accessory-update", handleAccessoryChange);
    return () => {
      window.removeEventListener("kanoha-accessory-update", handleAccessoryChange);
    };
  }, []);

  const clothes = accessories.clothes || "clothes_tshirt";

  return (
    <aside className={styles.coach} aria-label={`かのはコーチ: ${message}`}>
      <div className={styles.speechBubble}>
        <p className={styles.speechText}>{message}</p>
        <span className={styles.speechArrow} aria-hidden="true" />
      </div>

      <div className={styles.coachAvatarWrapper} data-mood={mood} aria-hidden="true">
        {/* Decorative sparkles for celebrate / think */}
        {mood === "celebrate" && (
          <div className={styles.celebrateStars}>
            <span className={styles.star1}>✦</span>
            <span className={styles.star2}>★</span>
            <span className={styles.star3}>✨</span>
          </div>
        )}
        {mood === "think" && (
          <div className={styles.thinkBubble}>
            <span>？</span>
          </div>
        )}

        {/* 3D WebGL Character (Three.js) when supported */}
        {mounted && use3D ? (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <ThreeCharacterCoach mood={mood} accessories={accessories} />
          </div>
        ) : (
          /* Human Child Coach SVG Fallback (For SSR / Test / Non-WebGL environments) */
          <svg
            className={styles.coachSvg}
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="hairGrad" x1="40" y1="20" x2="120" y2="90" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6d4c41" />
                <stop offset="100%" stopColor="#4e342e" />
              </linearGradient>

              <linearGradient id="skinGrad" x1="60" y1="40" x2="100" y2="120" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fff1e6" />
                <stop offset="100%" stopColor="#ffd8c0" />
              </linearGradient>

              <linearGradient id="clothGradHappy" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#0d9f8c" />
              </linearGradient>
              <linearGradient id="clothGradThink" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="clothGradCelebrate" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ff7b6b" />
                <stop offset="100%" stopColor="#ff5b4f" />
              </linearGradient>

              {/* 着せ替え服グラデーション */}
              <linearGradient id="clothGradSchool" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
              <linearGradient id="clothGradSafari" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#d4a373" />
                <stop offset="100%" stopColor="#b08968" />
              </linearGradient>
              <linearGradient id="clothGradHoodie" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <linearGradient id="clothGradWizard" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#9333ea" />
                <stop offset="100%" stopColor="#581c87" />
              </linearGradient>
              <linearGradient id="clothGradHero" x1="40" y1="100" x2="120" y2="160" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>

            {/* 地面の影 */}
            <ellipse cx="80" cy="150" rx="42" ry="6" fill="rgba(22, 36, 59, 0.12)" className={styles.groundShadow} />

            {/* 勇者の赤いマント */}
            {clothes === "clothes_hero" && (
              <path d="M34 118 L80 100 L126 118 L130 156 L30 156 Z" fill="#d90429" />
            )}

            {/* 後ろ髪 */}
            <circle cx="80" cy="68" r="48" fill="url(#hairGrad)" />

            {/* 体・洋服 */}
            <path
              d="M44 122 C44 104 60 98 80 98 C100 98 116 104 116 122 L120 152 C120 155 116 156 112 156 L48 156 C44 156 40 155 40 152 Z"
              fill={
                clothes === "clothes_school"
                  ? "url(#clothGradSchool)"
                  : clothes === "clothes_safari"
                  ? "url(#clothGradSafari)"
                  : clothes === "clothes_hoodie"
                  ? "url(#clothGradHoodie)"
                  : clothes === "clothes_wizard"
                  ? "url(#clothGradWizard)"
                  : clothes === "clothes_hero"
                  ? "url(#clothGradHero)"
                  : mood === "celebrate"
                  ? "url(#clothGradCelebrate)"
                  : mood === "think"
                  ? "url(#clothGradThink)"
                  : "url(#clothGradHappy)"
              }
              stroke="#ffffff"
              strokeWidth="3.5"
            />

            {/* 白い襟 / 襟元装飾 */}
            {clothes === "clothes_school" ? (
              <>
                <path d="M72 98 L80 110 L88 98 Z" fill="#ffffff" />
                {/* 赤いリボンタイ */}
                <path d="M76 106 L84 106 L80 116 Z" fill="#ef4444" />
                <circle cx="80" cy="126" r="2.5" fill="#facc15" />
                <circle cx="80" cy="138" r="2.5" fill="#facc15" />
              </>
            ) : clothes === "clothes_safari" ? (
              <>
                <path d="M72 98 L80 106 L88 98 Z" fill="#15803d" />
                <rect x="52" y="122" width="16" height="14" rx="2" fill="#996e47" />
                <rect x="92" y="122" width="16" height="14" rx="2" fill="#996e47" />
              </>
            ) : clothes === "clothes_hoodie" ? (
              <>
                <path d="M68 98 C68 108 92 108 92 98 Z" fill="#c2410c" />
                <rect x="62" y="132" width="36" height="16" rx="4" fill="#c2410c" opacity="0.6" />
              </>
            ) : clothes === "clothes_wizard" ? (
              <>
                <path d="M73 98 L80 108 L87 98 Z" fill="#facc15" />
                <line x1="80" y1="108" x2="80" y2="154" stroke="#facc15" strokeWidth="2.5" />
              </>
            ) : clothes === "clothes_hero" ? (
              <>
                <path d="M70 98 L80 108 L90 98 Z" fill="#f59e0b" />
                {/* 勇者のブルーダイヤクリスタル */}
                <polygon points="80,114 86,122 80,130 74,122" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
              </>
            ) : (
              <path d="M72 98 L80 110 L88 98 Z" fill="#ffffff" />
            )}

            {/* 首 */}
            <rect x="73" y="86" width="14" height="16" rx="6" fill="#ffd8c0" />

            {/* 耳 */}
            <circle cx="34" cy="74" r="9" fill="#ffd8c0" stroke="#f0bba0" strokeWidth="1.5" />
            <circle cx="126" cy="74" r="9" fill="#ffd8c0" stroke="#f0bba0" strokeWidth="1.5" />

            {/* 顔 */}
            <circle
              cx="80"
              cy="72"
              r="40"
              fill="url(#skinGrad)"
              stroke="#ffffff"
              strokeWidth="4"
              className={styles.bodyShape}
            />

            {/* 前髪 */}
            <path
              d="M40 68 C42 42 60 30 80 30 C100 30 118 42 120 68 C116 54 106 46 96 52 C88 56 86 48 76 52 C66 56 52 50 40 68 Z"
              fill="url(#hairGrad)"
            />

            {/* ほっぺ */}
            <ellipse cx="54" cy="85" rx="8" ry="5" fill="#ff7694" opacity="0.6" />
            <ellipse cx="106" cy="85" rx="8" ry="5" fill="#ff7694" opacity="0.6" />

            {/* 表情 */}
            {mood === "happy" && (
              <g className={styles.faceFeatures}>
                {/* 眉 */}
                <path d="M52 64 Q60 60 68 64" stroke="#4e342e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M92 64 Q100 60 108 64" stroke="#4e342e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                {/* 目 */}
                <circle cx="60" cy="73" r="6" fill="#16243b" className={styles.eyeBlink} />
                <circle cx="58" cy="71" r="2.2" fill="#ffffff" />
                <circle cx="100" cy="73" r="6" fill="#16243b" className={styles.eyeBlink} />
                <circle cx="98" cy="71" r="2.2" fill="#ffffff" />
                {/* 口 */}
                <path d="M72 82 Q80 91 88 82" stroke="#16243b" strokeWidth="3" strokeLinecap="round" fill="none" />
              </g>
            )}

            {mood === "think" && (
              <g className={styles.faceFeatures}>
                {/* 眉（考え中） */}
                <path d="M52 63 Q60 66 68 62" stroke="#4e342e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M92 62 Q100 66 108 63" stroke="#4e342e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                {/* 目 */}
                <circle cx="61" cy="72" r="6" fill="#16243b" />
                <circle cx="63" cy="70" r="2.2" fill="#ffffff" />
                <circle cx="101" cy="72" r="6" fill="#16243b" />
                <circle cx="103" cy="70" r="2.2" fill="#ffffff" />
                {/* 口（おちょぼ口） */}
                <ellipse cx="80" cy="84" rx="4" ry="4.5" fill="#16243b" />
              </g>
            )}

            {mood === "celebrate" && (
              <g className={styles.faceFeatures}>
                {/* 笑顔の目（ニコニコ線） */}
                <path d="M53 74 Q61 64 69 74" stroke="#16243b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                <path d="M91 74 Q99 64 107 74" stroke="#16243b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                {/* 笑顔の口 */}
                <path d="M70 82 Q80 97 90 82 Z" fill="#ff4d6d" stroke="#16243b" strokeWidth="2.5" />
              </g>
            )}

            {/* 手 */}
            {mood === "celebrate" ? (
              <g className={styles.handsCelebrate}>
                <circle cx="30" cy="62" r="8" fill="#ffd8c0" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="130" cy="62" r="8" fill="#ffd8c0" stroke="#ffffff" strokeWidth="2.5" />
              </g>
            ) : mood === "think" ? (
              <g className={styles.handsResting}>
                <circle cx="80" cy="94" r="7" fill="#ffd8c0" stroke="#ffffff" strokeWidth="2" />
              </g>
            ) : (
              <g className={styles.handsResting}>
                <circle cx="36" cy="120" r="7.5" fill="#ffd8c0" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="124" cy="110" r="7.5" fill="#ffd8c0" stroke="#ffffff" strokeWidth="2.5" />
              </g>
            )}
          </svg>
        )}
      </div>
    </aside>
  );
}
