"use client";

import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { ThreeCharacterCoach } from "./ThreeCharacterCoach";

export function CharacterCoach({
  message,
  mood = "happy",
}: {
  message: string;
  mood?: "happy" | "think" | "celebrate";
}) {
  const [mounted, setMounted] = useState(false);
  const [use3D, setUse3D] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setUse3D(Boolean(gl));
    } catch {
      setUse3D(false);
    }
  }, []);

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
            <ThreeCharacterCoach mood={mood} />
          </div>
        ) : (
          /* SVG Mascot Fallback (For SSR / Test / Non-WebGL environments) */
          <svg
            className={styles.coachSvg}
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="coachBodyGradHappy" x1="20" y1="20" x2="140" y2="150" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="60%" stopColor="#0d9f8c" />
                <stop offset="100%" stopColor="#08796c" />
              </linearGradient>
              <linearGradient id="coachBodyGradThink" x1="20" y1="20" x2="140" y2="150" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="60%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
              <linearGradient id="coachBodyGradCelebrate" x1="20" y1="20" x2="140" y2="150" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ff7b6b" />
                <stop offset="60%" stopColor="#ff5b4f" />
                <stop offset="100%" stopColor="#e1382b" />
              </linearGradient>

              <linearGradient id="sproutGrad" x1="80" y1="10" x2="80" y2="55" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#a3e635" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>

              <radialGradient id="highlightGlow" cx="60" cy="50" r="50" fx="50" fy="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="80" cy="148" rx="42" ry="7" fill="rgba(22, 36, 59, 0.12)" className={styles.groundShadow} />

            <g className={styles.sproutGroup}>
              <path
                d="M80 50 C80 34 85 24 94 20 C96 28 92 38 83 45"
                fill="url(#sproutGrad)"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M80 50 C76 36 68 28 58 27 C58 36 66 43 77 47"
                fill="url(#sproutGrad)"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="80" cy="48" r="3.5" fill="#4ade80" />
            </g>

            <rect
              x="24"
              y="42"
              width="112"
              height="102"
              rx="51"
              fill={
                mood === "celebrate"
                  ? "url(#coachBodyGradCelebrate)"
                  : mood === "think"
                  ? "url(#coachBodyGradThink)"
                  : "url(#coachBodyGradHappy)"
              }
              stroke="#ffffff"
              strokeWidth="5"
              className={styles.bodyShape}
            />
            <ellipse cx="64" cy="68" rx="30" ry="18" fill="url(#highlightGlow)" />

            <ellipse cx="48" cy="104" rx="9" ry="5.5" fill="#ff7694" opacity="0.65" />
            <ellipse cx="112" cy="104" rx="9" ry="5.5" fill="#ff7694" opacity="0.65" />

            {mood === "happy" && (
              <g className={styles.faceFeatures}>
                <circle cx="58" cy="88" r="7.5" fill="#16243b" className={styles.eyeBlink} />
                <circle cx="56" cy="85.5" r="2.8" fill="#ffffff" />
                <circle cx="102" cy="88" r="7.5" fill="#16243b" className={styles.eyeBlink} />
                <circle cx="100" cy="85.5" r="2.8" fill="#ffffff" />
                <path
                  d="M72 98 Q80 108 88 98"
                  stroke="#16243b"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}

            {mood === "think" && (
              <g className={styles.faceFeatures}>
                <circle cx="60" cy="84" r="8" fill="#16243b" />
                <circle cx="63" cy="81" r="3" fill="#ffffff" />
                <circle cx="104" cy="84" r="8" fill="#16243b" />
                <circle cx="107" cy="81" r="3" fill="#ffffff" />
                <ellipse cx="80" cy="101" rx="5" ry="6" fill="#16243b" />
              </g>
            )}

            {mood === "celebrate" && (
              <g className={styles.faceFeatures}>
                <path
                  d="M51 90 Q58 79 66 90"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M94 90 Q102 79 110 90"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M68 97 Q80 114 92 97 Z"
                  fill="#ffffff"
                />
                <path
                  d="M73 103 Q80 111 87 103"
                  fill="#ff4d6d"
                />
              </g>
            )}

            {mood === "celebrate" ? (
              <g className={styles.handsCelebrate}>
                <ellipse cx="23" cy="62" rx="9" ry="11" fill="#ff7b6b" stroke="#ffffff" strokeWidth="3" transform="rotate(-30 23 62)" />
                <ellipse cx="137" cy="62" rx="9" ry="11" fill="#ff7b6b" stroke="#ffffff" strokeWidth="3" transform="rotate(30 137 62)" />
              </g>
            ) : (
              <g className={styles.handsResting}>
                <ellipse cx="32" cy="116" rx="9" ry="7" fill={mood === "think" ? "#818cf8" : "#2dd4bf"} stroke="#ffffff" strokeWidth="3" />
                <ellipse cx="128" cy="116" rx="9" ry="7" fill={mood === "think" ? "#818cf8" : "#2dd4bf"} stroke="#ffffff" strokeWidth="3" />
              </g>
            )}
          </svg>
        )}
      </div>
    </aside>
  );
}
