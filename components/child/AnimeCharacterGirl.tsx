"use client";

import React, { useState, useEffect, useRef } from "react";
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
 * 本格骨格・ボーン連動アニメーションエンジン搭載「かのはちゃん」
 * 手を振る、首をかしげる、呼吸する、ツインテールがサラサラ揺れる、
 * 視線がマウスを追い、まばたきし、口元が生き生きと動く「完全に生きた人間のアニメキャラクター」。
 */
export function AnimeCharacterGirl({
  mood = "happy",
  level = 1,
  accessories,
  className,
  onClick,
}: AnimeCharacterGirlProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 物理・アニメーション状態
  const [frame, setFrame] = useState({
    breathY: 0,
    headAngle: 0,
    headY: 0,
    waveArmAngle: 0,
    forearmAngle: 0,
    handAngle: 0,
    leftTailAngle: 0,
    rightTailAngle: 0,
    skirtSway: 0,
    eyeOffsetX: 0,
    eyeOffsetY: 0,
    blinkScale: 1,
    mouthY: 0,
    jumpY: 0,
    rotX: 0,
    rotY: 0,
    animTime: 0,
  });

  const mousePos = useRef({ x: 0, y: 0 });
  const targetLook = useRef({ x: 0, y: 0 });
  const jumpSpring = useRef({ y: 0, velocity: 0 });
  const blinkTimer = useRef(0);
  const isBlinking = useRef(false);
  const blinkDuration = useRef(0);

  // マウス追従
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2));
      const y = ((e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2));
      mousePos.current.x = Math.max(-1, Math.min(1, x));
      mousePos.current.y = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // リアルタイム骨格アニメーションループ
  useEffect(() => {
    let animId: number;
    let startTime = performance.now();
    let lastTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const t = (now - startTime) / 1000;

      // ジャンプスプリング減衰
      jumpSpring.current.velocity += (0 - jumpSpring.current.y) * 22 * dt;
      jumpSpring.current.velocity *= 0.88;
      jumpSpring.current.y += jumpSpring.current.velocity;

      // 視線・頭の滑らかな追従 (Lerp)
      targetLook.current.x += (mousePos.current.x - targetLook.current.x) * 0.08;
      targetLook.current.y += (mousePos.current.y - targetLook.current.y) * 0.08;

      // 1. 呼吸アニメーション (全身の微細な上下動と膨らみ)
      const breathY = Math.sin(t * 2.4) * 2.5;

      // 2. 首・頭部の角度 (無意識の首かしげ + マウス追従)
      const idleTilt = Math.sin(t * 1.5) * 2.5;
      const headAngle = (mood === "think" ? -8 : idleTilt) + targetLook.current.x * 6;
      const headY = breathY * 0.6 + targetLook.current.y * 3;

      // 3. 手を振る動き (Waving Hand Animation)
      let waveArmAngle = 0;
      let forearmAngle = 0;
      let handAngle = 0;

      if (mood === "celebrate") {
        // 大喜び：両手バンザイジャンプで元気に手を振る
        waveArmAngle = -140 + Math.sin(t * 8) * 12;
        forearmAngle = -20 + Math.sin(t * 8 + 0.5) * 10;
        handAngle = Math.sin(t * 10) * 15;
      } else if (mood === "think") {
        // 考え中：右手があごへ
        waveArmAngle = -45 + Math.sin(t * 1.8) * 3;
        forearmAngle = -65;
        handAngle = -10;
      } else {
        // 通常：右手を上げて可愛く「おーい！」と手を振る！
        const waveCycle = Math.sin(t * 4.2);
        waveArmAngle = -65 + waveCycle * 8;
        forearmAngle = -45 + Math.sin(t * 4.2 + 0.6) * 16;
        handAngle = Math.sin(t * 4.2 + 1.2) * 18;
      }

      // 4. ツインテールのスプリング物理揺れ (体の動きから遅れてしなやかに波打つ)
      const leftTailAngle = Math.sin(t * 2.8) * 6 - targetLook.current.x * 5 + breathY * 0.8;
      const rightTailAngle = -Math.sin(t * 2.8 + 0.5) * 6 - targetLook.current.x * 5 - breathY * 0.8;

      // 5. スカートのひらめき
      const skirtSway = Math.sin(t * 2.4) * 1.8 + targetLook.current.x * 2.5;

      // 6. 瞳の視線オフセット (-4px 〜 +4px)
      const eyeOffsetX = targetLook.current.x * 4.5;
      const eyeOffsetY = targetLook.current.y * 2.5;

      // 7. まばたきアニメーション
      blinkTimer.current += dt;
      let blinkScale = 1;
      if (!isBlinking.current && blinkTimer.current > 2.6 + Math.random() * 2.4) {
        isBlinking.current = true;
        blinkTimer.current = 0;
        blinkDuration.current = 0;
      }
      if (isBlinking.current) {
        blinkDuration.current += dt;
        blinkScale = blinkDuration.current < 0.08 ? 0.08 : 1;
        if (blinkDuration.current > 0.16) {
          isBlinking.current = false;
          blinkScale = 1;
        }
      }

      // 8. 口元の呼吸アニメーション
      const mouthY = Math.sin(t * 2.4) * 0.8;

      // 9. 3D パースペクティブ回転 (マウス追従)
      const rotY = targetLook.current.x * 12;
      const rotX = -targetLook.current.y * 7;

      setFrame({
        breathY,
        headAngle,
        headY,
        waveArmAngle,
        forearmAngle,
        handAngle,
        leftTailAngle,
        rightTailAngle,
        skirtSway,
        eyeOffsetX,
        eyeOffsetY,
        blinkScale,
        mouthY,
        jumpY: jumpSpring.current.y,
        rotX,
        rotY,
        animTime: t,
      });
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [mood]);

  const handleCharacterClick = () => {
    jumpSpring.current.velocity = -28;
    if (onClick) onClick();
  };

  const clothes = accessories?.clothes || "clothes_school";
  const hat = accessories?.hat || "hat_none";
  const glasses = accessories?.glasses || "glasses_none";

  return (
    <div
      ref={containerRef}
      className={`${styles.animeGirlContainer || ""} ${className || ""}`}
      data-mood={mood}
      onClick={handleCharacterClick}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        userSelect: "none",
        cursor: "pointer",
      }}
      title="クリックしてみてね！"
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `perspective(600px) rotateY(${frame.rotY}deg) rotateX(${frame.rotX}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.05s linear",
        }}
      >
        <svg
          viewBox="0 0 220 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%",
            height: "100%",
            overflow: "visible",
            filter: "drop-shadow(0 10px 20px rgba(19, 34, 56, 0.16))",
          }}
        >
          {/* 3D 浮遊星屑パーティクル */}
          <g opacity={mood === "celebrate" ? 0.95 : 0.75}>
            <circle
              cx={24 + Math.sin(frame.animTime * 2.2) * 5}
              cy={52 + Math.cos(frame.animTime * 1.8) * 6}
              r="2.5"
              fill="#facc15"
            />
            <path
              d={`M${196 + Math.cos(frame.animTime * 2.5) * 5} ${75 + Math.sin(frame.animTime * 2) * 6} l 3 3 l -3 3 l -3 -3 Z`}
              fill="#38bdf8"
            />
            <circle
              cx={28 + Math.sin(frame.animTime * 1.6) * 4}
              cy={145 + Math.cos(frame.animTime * 2.1) * 5}
              r="2"
              fill="#f472b6"
            />
            <polygon
              points={`${188 + Math.sin(frame.animTime * 2) * 4},${160 + Math.cos(frame.animTime * 2) * 4} ${191 + Math.sin(frame.animTime * 2) * 4},${165 + Math.cos(frame.animTime * 2) * 4} ${185 + Math.sin(frame.animTime * 2) * 4},${165 + Math.cos(frame.animTime * 2) * 4}`}
              fill="#34d399"
            />
          </g>
        <defs>
          {/* 髪色パレット（柔らかなショコラブラウン） */}
          <linearGradient id="liveHairGrad" x1="60" y1="20" x2="160" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#96562f" />
            <stop offset="50%" stopColor="#753d1b" />
            <stop offset="100%" stopColor="#4f240d" />
          </linearGradient>

          {/* ツインテールグラデーション */}
          <linearGradient id="liveTailGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#874722" />
            <stop offset="70%" stopColor="#693213" />
            <stop offset="100%" stopColor="#451e08" />
          </linearGradient>

          {/* 天使の輪（ハイライト） */}
          <linearGradient id="liveHaloGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255, 245, 230, 0)" />
            <stop offset="30%" stopColor="rgba(255, 240, 215, 0.7)" />
            <stop offset="50%" stopColor="rgba(255, 255, 245, 0.95)" />
            <stop offset="70%" stopColor="rgba(255, 240, 215, 0.7)" />
            <stop offset="100%" stopColor="rgba(255, 245, 230, 0)" />
          </linearGradient>

          {/* アニメ白肌グラデーション */}
          <linearGradient id="liveSkinGrad" x1="70" y1="40" x2="150" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff9f5" />
            <stop offset="75%" stopColor="#feeddd" />
            <stop offset="100%" stopColor="#f8d6be" />
          </linearGradient>

          {/* 澄んだエメラルドスカイブルーの瞳 */}
          <linearGradient id="liveEyeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#081b3a" />
            <stop offset="30%" stopColor="#0284c7" />
            <stop offset="70%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* スクールネイビー */}
          <linearGradient id="liveNavyGrad" x1="60" y1="110" x2="160" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#253a5e" />
            <stop offset="60%" stopColor="#1a2b47" />
            <stop offset="100%" stopColor="#101c30" />
          </linearGradient>

          {/* コーラルピンクリボンタイ */}
          <linearGradient id="liveRibbonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff5376" />
            <stop offset="60%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>

          {/* エナメルローファー */}
          <linearGradient id="liveShoeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c3014" />
            <stop offset="65%" stopColor="#3e1b07" />
            <stop offset="100%" stopColor="#220d02" />
          </linearGradient>
        </defs>

        {/* 1. 地面の動的ソフトシャドウ（ジャンプに合わせて拡縮） */}
        <ellipse
          cx="110"
          cy="268"
          rx={Math.max(20, 52 + frame.jumpY * 0.4)}
          ry={Math.max(3, 7 + frame.jumpY * 0.08)}
          fill="rgba(19, 34, 56, 0.22)"
        />

        {/* 2. キャラクター全体ルート（ジャンプ連動） */}
        <g transform={`translate(0, ${frame.jumpY})`}>
          {/* ========================================================
              下半身（脚・レース付き白ソックス・ローファー）
              ======================================================== */}
          <g>
            {/* 左脚 */}
            <g transform="translate(84, 182)">
              <rect x="0" y="0" width="20" height="42" rx="9" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="2.4" />
              <ellipse cx="10" cy="18" rx="5" ry="3.5" fill="#fbcfe8" opacity="0.4" />
              {/* ソックス */}
              <rect x="0" y="24" width="20" height="34" rx="6" fill="#ffffff" stroke="#1a2436" strokeWidth="2.4" />
              {/* フリルレース */}
              <path d="M-3 24 Q3 20 8 24 Q13 20 18 24 Q23 20 23 24" stroke="#1a2436" strokeWidth="2" fill="#fff" />
              {/* ローファー */}
              <g transform="translate(-8, 52)">
                <rect x="0" y="14" width="36" height="8" rx="3.5" fill="#1e293b" stroke="#1a2436" strokeWidth="2" />
                <path d="M4 6 C4 6 14 3 26 6 C30 8 32 12 32 15 L4 15 Z" fill="url(#liveShoeGrad)" stroke="#1a2436" strokeWidth="2.2" />
                <rect x="12" y="7" width="13" height="3.5" rx="1.5" fill="#3e1b07" stroke="#1a2436" strokeWidth="1.2" />
                <circle cx="18" cy="8.7" r="1.5" fill="#facc15" />
                <ellipse cx="26" cy="9" rx="3.5" ry="1.8" fill="rgba(255,255,255,0.75)" />
              </g>
            </g>

            {/* 右脚 */}
            <g transform="translate(116, 182)">
              <rect x="0" y="0" width="20" height="42" rx="9" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="2.4" />
              <ellipse cx="10" cy="18" rx="5" ry="3.5" fill="#fbcfe8" opacity="0.4" />
              <rect x="0" y="24" width="20" height="34" rx="6" fill="#ffffff" stroke="#1a2436" strokeWidth="2.4" />
              <path d="M-3 24 Q3 20 8 24 Q13 20 18 24 Q23 20 23 24" stroke="#1a2436" strokeWidth="2" fill="#fff" />
              <g transform="translate(-8, 52)">
                <rect x="0" y="14" width="36" height="8" rx="3.5" fill="#1e293b" stroke="#1a2436" strokeWidth="2" />
                <path d="M4 6 C4 6 14 3 26 6 C30 8 32 12 32 15 L4 15 Z" fill="url(#liveShoeGrad)" stroke="#1a2436" strokeWidth="2.2" />
                <rect x="12" y="7" width="13" height="3.5" rx="1.5" fill="#3e1b07" stroke="#1a2436" strokeWidth="1.2" />
                <circle cx="18" cy="8.7" r="1.5" fill="#facc15" />
                <ellipse cx="26" cy="9" rx="3.5" ry="1.8" fill="rgba(255,255,255,0.75)" />
              </g>
            </g>
          </g>

          {/* ========================================================
              上半身 & 体幹グループ（呼吸で上下動）
              ======================================================== */}
          <g transform={`translate(0, ${frame.breathY})`}>
            {/* プリーツスカート（ひらひらスウェイ） */}
            <g transform={`translate(110, 150) rotate(${frame.skirtSway}) translate(-110, -150)`}>
              <path
                d="M72 152 C72 152 90 148 110 148 C130 148 148 152 148 152 L158 190 C140 194 110 195 62 190 Z"
                fill="#24385c"
                stroke="#1a2436"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* ひだライン */}
              <line x1="86" y1="150" x2="78" y2="190" stroke="#182740" strokeWidth="2" />
              <line x1="100" y1="149" x2="96" y2="191" stroke="#182740" strokeWidth="2" />
              <line x1="110" y1="148" x2="110" y2="192" stroke="#182740" strokeWidth="2" />
              <line x1="120" y1="149" x2="124" y2="191" stroke="#182740" strokeWidth="2" />
              <line x1="134" y1="150" x2="142" y2="190" stroke="#182740" strokeWidth="2" />
              {/* ホワイトセーラー裾ライン */}
              <path d="M68 184 C92 188 128 188 152 184" stroke="#ffffff" strokeWidth="2.5" fill="none" />
              {/* ウエストベルト & バックル */}
              <path d="M74 152 Q110 148 146 152" stroke="#451e08" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="105" y="148" width="10" height="6" rx="2" fill="#facc15" stroke="#1a2436" strokeWidth="1.2" />
            </g>

            {/* 体幹（白ブラウス & ネイビーベスト） */}
            <g>
              <path
                d="M68 112 C68 102 85 98 110 98 C135 98 152 102 152 112 L148 154 C134 156 122 156 110 156 C98 156 86 156 72 154 Z"
                fill="url(#liveNavyGrad)"
                stroke="#1a2436"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              {/* 丸襟ブラウス（ピーターパンカラー） */}
              <path d="M90 100 C86 109 98 117 110 114 C122 117 134 109 130 100 Z" fill="#ffffff" stroke="#1a2436" strokeWidth="2" />
              {/* Vネックインナー & 金ボタン */}
              <polygon points="92,102 110,126 128,102" fill="#ffffff" stroke="#1a2436" strokeWidth="1.6" />
              <circle cx="110" cy="134" r="3" fill="#facc15" stroke="#1a2436" strokeWidth="1" />
              <circle cx="110" cy="144" r="3" fill="#facc15" stroke="#1a2436" strokeWidth="1" />

              {/* ふっくら立体リボンタイ（呼吸でふわふわ弾む） */}
              <g transform="translate(110, 110)">
                <path d="M0 0 C-10 -7 -25 -5 -22 6 C-20 14 -6 10 0 2 Z" fill="url(#liveRibbonGrad)" stroke="#1a2436" strokeWidth="2" />
                <path d="M0 0 C10 -7 25 -5 22 6 C20 14 6 10 0 2 Z" fill="url(#liveRibbonGrad)" stroke="#1a2436" strokeWidth="2" />
                <path d="M-4 3 L-9 22 L-2 18 L0 5 Z" fill="#be123c" stroke="#1a2436" strokeWidth="1.5" />
                <path d="M4 3 L9 22 L2 18 L0 5 Z" fill="#be123c" stroke="#1a2436" strokeWidth="1.5" />
                <ellipse cx="0" cy="2" rx="5" ry="4.5" fill="#ff4d79" stroke="#1a2436" strokeWidth="2" />
                <circle cx="0" cy="2" r="1.8" fill="#fff" opacity="0.7" />
              </g>
            </g>

            {/* ========================================================
                左腕（肩→肘→手首：自然にお行儀よく添える）
                ======================================================== */}
            <g transform="translate(70, 110)">
              {/* パフスリーブ */}
              <circle cx="0" cy="0" r="11" fill="#ffffff" stroke="#1a2436" strokeWidth="2.2" />
              {/* 上腕〜前腕 */}
              <path d="M-2 4 Q-8 22 14 34" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" fill="none" />
              <path d="M-2 4 Q-8 22 14 34" stroke="#1a2436" strokeWidth="2.2" fill="none" />
              {/* 可愛い左手 */}
              <g transform="translate(14, 34)">
                <circle cx="0" cy="0" r="7" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="2" />
                <ellipse cx="4" cy="-2" rx="3" ry="2" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="1.5" />
              </g>
            </g>

            {/* ========================================================
                右腕（【手を振るボーンアニメーション】肩→肘→手首→手）
                ======================================================== */}
            <g transform="translate(150, 110)">
              {/* パフスリーブ */}
              <circle cx="0" cy="0" r="11" fill="#ffffff" stroke="#1a2436" strokeWidth="2.2" />

              {/* 上腕ボーン（肩関節で回転） */}
              <g transform={`rotate(${frame.waveArmAngle})`}>
                <line x1="0" y1="0" x2="22" y2="0" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
                <line x1="0" y1="0" x2="22" y2="0" stroke="#1a2436" strokeWidth="2.2" />

                {/* 肘関節ボーン（前腕が曲がってしなる） */}
                <g transform={`translate(22, 0) rotate(${frame.forearmAngle})`}>
                  <line x1="0" y1="0" x2="24" y2="0" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" />
                  <line x1="0" y1="0" x2="24" y2="0" stroke="#1a2436" strokeWidth="2.2" />

                  {/* 手首関節ボーン（可愛いおててがパタパタ手を振る！） */}
                  <g transform={`translate(24, 0) rotate(${frame.handAngle})`}>
                    {/* 手のひら */}
                    <circle cx="4" cy="0" r="7.5" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="2" />
                    {/* 親指 */}
                    <path d="M1 -4 C5 -8 9 -5 6 -1 Z" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="1.5" />
                    {/* 振られる4本指 */}
                    <path d="M7 -4 L14 -3 C16 -1 16 1 14 2 L8 2" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="1.5" />
                    <path d="M8 2 L13 4 C15 6 14 7 12 7 L6 5" fill="url(#liveSkinGrad)" stroke="#1a2436" strokeWidth="1.5" />
                  </g>
                </g>
              </g>
            </g>

            {/* ========================================================
                頭部グループ（首関節でピッチ・ロール・ヨー首振り）
                ======================================================== */}
            <g transform={`translate(110, ${64 + frame.headY}) rotate(${frame.headAngle}) translate(-110, -64)`}>
              {/* 首 */}
              <rect x="103" y="80" width="14" height="20" rx="6" fill="#fcd9c2" stroke="#1a2436" strokeWidth="2" />

              {/* 後頭部の髪 */}
              <circle cx="110" cy="56" r="48" fill="url(#liveHairGrad)" stroke="#1a2436" strokeWidth="3" />

              {/* 左右のふんわりツインテール（物理スプリング揺れ連動） */}
              {/* 左ツインテール */}
              <g transform={`translate(56, 52) rotate(${frame.leftTailAngle}) translate(-56, -52)`}>
                <ellipse cx="56" cy="52" rx="7" ry="5" fill="#ff4d79" stroke="#1a2436" strokeWidth="2" />
                <circle cx="56" cy="52" r="2.5" fill="#fff" />
                <path
                  d="M56 54 C36 72 28 98 44 122 C54 130 64 116 62 102 C60 86 64 70 62 56 Z"
                  fill="url(#liveTailGrad)"
                  stroke="#1a2436"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                <path d="M46 84 C42 102 50 114 54 118" stroke="#451e08" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </g>

              {/* 右ツインテール */}
              <g transform={`translate(164, 52) rotate(${frame.rightTailAngle}) translate(-164, -52)`}>
                <ellipse cx="164" cy="52" rx="7" ry="5" fill="#ff4d79" stroke="#1a2436" strokeWidth="2" />
                <circle cx="164" cy="52" r="2.5" fill="#fff" />
                <path
                  d="M164 54 C184 72 192 98 176 122 C166 130 156 116 158 102 C160 86 156 70 158 56 Z"
                  fill="url(#liveTailGrad)"
                  stroke="#1a2436"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                <path d="M174 84 C178 102 170 114 166 118" stroke="#451e08" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              </g>

              {/* 耳 */}
              <circle cx="67" cy="62" r="8" fill="#feeddd" stroke="#1a2436" strokeWidth="2" />
              <circle cx="153" cy="62" r="8" fill="#feeddd" stroke="#1a2436" strokeWidth="2" />

              {/* 顔の輪郭（愛らしく柔らかいアニメ輪郭） */}
              <path
                d="M68 50 C68 26 86 16 110 16 C134 16 152 26 152 50 C152 70 144 83 129 93 C120 99 115 101 110 101 C105 101 100 99 91 93 C76 83 68 70 68 50 Z"
                fill="url(#liveSkinGrad)"
                stroke="#1a2436"
                strokeWidth="3.2"
              />

              {/* 天使の輪（前髪ハイライトリング） */}
              <ellipse cx="110" cy="32" rx="34" ry="8" fill="url(#liveHaloGrad)" />

              {/* ほんのり桜色チーク＆照れ線 */}
              <ellipse cx="82" cy="71" rx="10" ry="6.5" fill="#ff7694" opacity="0.65" />
              <line x1="78" y1="73" x2="82" y2="67" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="83" y1="73" x2="87" y2="67" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

              <ellipse cx="138" cy="71" rx="10" ry="6.5" fill="#ff7694" opacity="0.65" />
              <line x1="134" y1="73" x2="138" y2="67" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="139" y1="73" x2="143" y2="67" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />

              {/* ちょこんとしたアニメ鼻 */}
              <circle cx="110" cy="67" r="1.2" fill="#d97706" />

              {/* 口（笑顔 / おちょぼ口 / リップ呼吸） */}
              <g transform={`translate(110, ${76 + frame.mouthY})`}>
                {mood === "celebrate" ? (
                  <g>
                    <path d="M-9 0 Q0 18 9 0 Z" fill="#be123c" stroke="#1a2436" strokeWidth="2.2" />
                    <path d="M-7 1 L7 1 L7 3 L-7 3 Z" fill="#ffffff" />
                    <path d="M-6 8 Q0 4 6 8 Q0 13 -6 8 Z" fill="#fb7185" />
                  </g>
                ) : mood === "think" ? (
                  <ellipse cx="0" cy="0" rx="3.5" ry="4.5" fill="#1a2436" />
                ) : (
                  <g>
                    <path d="M-8 0 Q0 9 8 0" stroke="#1a2436" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                    <ellipse cx="0" cy="4" rx="4.5" ry="1.8" fill="#f43f5e" opacity="0.6" />
                  </g>
                )}
              </g>

              {/* ========================================================
                  生きた瞳（視線マウス追従 & まばたき連動）
                  ======================================================== */}
              <g transform="translate(110, 60)">
                {/* 左目 */}
                <g transform="translate(-20, 0)">
                  {/* 白目 */}
                  <ellipse cx="0" cy="0" rx="10" ry="13.5" fill="#ffffff" stroke="#1a2436" strokeWidth="2.4" />
                  {/* まばたきスケールクリップ */}
                  <g transform={`scale(1, ${frame.blinkScale})`}>
                    {/* 虹彩（マウス視線オフセット追従） */}
                    <g transform={`translate(${frame.eyeOffsetX * 0.7}, ${frame.eyeOffsetY * 0.7})`}>
                      <ellipse cx="0" cy="0" rx="8" ry="11.5" fill="url(#liveEyeGrad)" />
                      {/* 瞳孔 */}
                      <ellipse cx="0" cy="-1" rx="4" ry="5.5" fill="#071120" />
                      {/* 下部エメラルド光 */}
                      <path d="M-5 5 Q0 11 5 5 Q0 8 -5 5 Z" fill="#67e8f9" />
                      {/* メイン主光ハイライト */}
                      <circle cx="-3" cy="-4" r="3.6" fill="#ffffff" />
                      {/* 星屑サブハイライト */}
                      <circle cx="3" cy="6" r="1.5" fill="#ffffff" />
                    </g>
                  </g>
                  {/* 太い上アイライン＆跳ね上げまつ毛 */}
                  <path d="M-11 -2 Q0 -13 11 -3" stroke="#1a2436" strokeWidth="4.2" strokeLinecap="round" fill="none" />
                  <path d="M10 -4 L15 -9" stroke="#1a2436" strokeWidth="2.8" strokeLinecap="round" />
                  {/* 二重ライン */}
                  <path d="M-9 -10 Q0 -15 9 -10" stroke="rgba(26, 36, 54, 0.45)" strokeWidth="1.6" fill="none" />
                </g>

                {/* 右目 */}
                <g transform="translate(20, 0)">
                  <ellipse cx="0" cy="0" rx="10" ry="13.5" fill="#ffffff" stroke="#1a2436" strokeWidth="2.4" />
                  <g transform={`scale(1, ${frame.blinkScale})`}>
                    <g transform={`translate(${frame.eyeOffsetX * 0.7}, ${frame.eyeOffsetY * 0.7})`}>
                      <ellipse cx="0" cy="0" rx="8" ry="11.5" fill="url(#liveEyeGrad)" />
                      <ellipse cx="0" cy="-1" rx="4" ry="5.5" fill="#071120" />
                      <path d="M-5 5 Q0 11 5 5 Q0 8 -5 5 Z" fill="#67e8f9" />
                      <circle cx="-3" cy="-4" r="3.6" fill="#ffffff" />
                      <circle cx="3" cy="6" r="1.5" fill="#ffffff" />
                    </g>
                  </g>
                  <path d="M-11 -3 Q0 -13 11 -2" stroke="#1a2436" strokeWidth="4.2" strokeLinecap="round" fill="none" />
                  <path d="M10 -3 L15 -7" stroke="#1a2436" strokeWidth="2.8" strokeLinecap="round" />
                  <path d="M-9 -10 Q0 -15 9 -10" stroke="rgba(26, 36, 54, 0.45)" strokeWidth="1.6" fill="none" />
                </g>
              </g>

              {/* 眉毛（表情変化） */}
              <g transform="translate(110, 46)">
                {mood === "think" ? (
                  <g>
                    <path d="M-29 3 Q-20 -4 -11 0" stroke="#542810" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                    <path d="M11 -1 Q20 -5 29 2" stroke="#542810" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                  </g>
                ) : (
                  <g>
                    <path d="M-30 0 Q-20 -6 -10 -1" stroke="#542810" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                    <path d="M10 -1 Q20 -6 30 0" stroke="#542810" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                  </g>
                )}
              </g>

              {/* 前髪（ふんわり束感のあるM字シースルーバング） */}
              <path
                d="M66 54 C69 26 88 18 110 18 C132 18 151 26 154 54 C147 40 138 35 129 46 C123 38 115 37 110 47 C105 37 97 38 91 46 C82 35 73 40 66 54 Z"
                fill="url(#liveHairGrad)"
                stroke="#1a2436"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />

              {/* サイド姫毛 */}
              <path d="M68 52 C65 65 66 76 71 84 C67 76 66 65 68 52 Z" fill="url(#liveHairGrad)" stroke="#1a2436" strokeWidth="2.2" />
              <path d="M152 52 C155 65 154 76 149 84 C153 76 154 65 152 52 Z" fill="url(#liveHairGrad)" stroke="#1a2436" strokeWidth="2.2" />

              {/* 頭頂のアホ毛（ぴょこんと揺れる） */}
              <path
                d="M111 17 C113 2 130 4 135 11 C126 11 119 14 115 19 Z"
                fill="url(#liveHairGrad)"
                stroke="#1a2436"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />

              {/* ミントグリーンのヘアピン */}
              <rect
                x="80"
                y="34"
                width="11"
                height="3.5"
                rx="1.7"
                fill="#2dd4bf"
                stroke="#1a2436"
                strokeWidth="1.4"
                transform="rotate(-22 80 34)"
              />

              {/* 着せ替えアクセサリ（帽子） */}
              {hat === "hat_beret" && (
                <g transform="translate(120, 14) rotate(12)">
                  <ellipse cx="0" cy="0" rx="34" ry="15" fill="#dc2626" stroke="#1a2436" strokeWidth="2.4" />
                  <line x1="0" y1="-15" x2="2" y2="-21" stroke="#1a2436" strokeWidth="3" strokeLinecap="round" />
                </g>
              )}
              {hat === "hat_crown" && (
                <g transform="translate(110, 16)">
                  <path d="M-22 3 L-20 -12 L-10 -4 L0 -16 L10 -4 L20 -12 L22 3 Z" fill="#f59e0b" stroke="#1a2436" strokeWidth="2.2" />
                  <circle cx="-20" cy="-12" r="2" fill="#ef4444" />
                  <circle cx="0" cy="-16" r="2.8" fill="#3b82f6" />
                  <circle cx="20" cy="-12" r="2" fill="#ef4444" />
                </g>
              )}

              {/* 着せ替えアクセサリ（メガネ） */}
              {glasses === "glasses_round" && (
                <g transform="translate(110, 60)">
                  <circle cx="-20" cy="0" r="13" fill="none" stroke="#d97706" strokeWidth="2.5" />
                  <circle cx="20" cy="0" r="13" fill="none" stroke="#d97706" strokeWidth="2.5" />
                  <path d="M-7 0 Q0 -2 7 0" stroke="#d97706" strokeWidth="2.5" fill="none" />
                </g>
              )}
            </g>
          </g>
        </g>
      </svg>
      </div>
    </div>
  );
}
