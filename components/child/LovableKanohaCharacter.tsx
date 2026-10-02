"use client";

import React, { useState, useEffect, useRef } from "react";
import type { EquippedAccessories } from "@/lib/rewards/characterGrowthStore";

interface LovableKanohaCharacterProps {
  mood?: "happy" | "think" | "celebrate";
  level?: number;
  accessories?: EquippedAccessories;
  className?: string;
  onClick?: () => void;
  celebrating?: boolean;
}

/**
 * 愛されパートナー「かのはちゃん」
 * 誰からも愛される、ころんと丸くて自然なマスコットキャラクター。
 * - 左右にてくてく歩き回る（お散歩・ステップ・パトロール）
 * - 問題を解いたときに大ジャンプ＆360度スピン＆パチパチ全力拍手で大喜び！
 * - 呼吸でぷにっと伸縮するスライム・スプリング物理
 * - つぶらな瞳のまばたき、視線追従、頭のふたばのぷるぷる揺れ
 */
export function LovableKanohaCharacter({
  mood = "happy",
  accessories,
  className,
  onClick,
  celebrating: propCelebrating = false,
}: LovableKanohaCharacterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 物理＆アニメーション状態
  const [frame, setFrame] = useState({
    walkX: 0,
    walkDirection: 1, // 1: 右向き, -1: 左向き
    bodyTilt: 0,
    breathScaleY: 1,
    breathScaleX: 1,
    leftFootY: 0,
    rightFootY: 0,
    sproutAngle: 0,
    rightArmAngle: 0,
    leftArmAngle: 0,
    eyeOffsetX: 0,
    eyeOffsetY: 0,
    blinkScale: 1,
    jumpY: 0,
    spinDeg: 0,
    isCelebrating: false,
    isSpeaking: false,
    animTime: 0,
  });

  const mousePos = useRef({ x: 0, y: 0 });
  const jumpSpring = useRef({ y: 0, velocity: 0 });
  const blinkTimer = useRef(0);
  const isBlinking = useRef(false);
  const celebrateTimer = useRef(0);
  const walkPhase = useRef(0);
  const currentWalkX = useRef(0);
  const walkTarget = useRef(0);
  const pauseTimer = useRef(1.5); // 歩行途中の立ち止まりタイマー

  // マウス追従
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2);
      const y = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2);
      mousePos.current.x = Math.max(-1, Math.min(1, x));
      mousePos.current.y = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const isSpeakingRef = useRef(false);

  // 発話イベント（リップシンク連動）
  useEffect(() => {
    const handleStartSpeaking = () => {
      isSpeakingRef.current = true;
    };
    const handleEndSpeaking = () => {
      isSpeakingRef.current = false;
    };

    window.addEventListener("kanoha-coach-speaking-start", handleStartSpeaking);
    window.addEventListener("kanoha-coach-speaking-end", handleEndSpeaking);

    return () => {
      window.removeEventListener("kanoha-coach-speaking-start", handleStartSpeaking);
      window.removeEventListener("kanoha-coach-speaking-end", handleEndSpeaking);
    };
  }, []);

  // 問題を解いたイベント・正解イベントをリッスン
  useEffect(() => {
    const handleProblemSolved = () => {
      jumpSpring.current.velocity = -32;
      celebrateTimer.current = 4.0; // 4秒間大喜び
    };

    window.addEventListener("kanoha-problem-solved", handleProblemSolved);
    window.addEventListener("kanoha-reward-update", handleProblemSolved);
    window.addEventListener("kanoha-level-up", handleProblemSolved);
    window.addEventListener("kanoha-five-yen-earned", handleProblemSolved);

    return () => {
      window.removeEventListener("kanoha-problem-solved", handleProblemSolved);
      window.removeEventListener("kanoha-reward-update", handleProblemSolved);
      window.removeEventListener("kanoha-level-up", handleProblemSolved);
      window.removeEventListener("kanoha-five-yen-earned", handleProblemSolved);
    };
  }, []);

  // メイン物理アニメーションループ
  useEffect(() => {
    let animId: number;
    const startTime = performance.now();
    let lastTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const t = (now - startTime) / 1000;

      // セレブレーション判定（props または イベント発火）
      if (propCelebrating && celebrateTimer.current < 2.0) {
        celebrateTimer.current = 2.5;
      }
      if (celebrateTimer.current > 0) {
        celebrateTimer.current -= dt;
      }
      const isCelebrating = mood === "celebrate" || celebrateTimer.current > 0;

      // 1. ジャンプ物理（バネ・重力）
      jumpSpring.current.velocity += (0 - jumpSpring.current.y) * 24 * dt;
      jumpSpring.current.velocity *= 0.88;
      jumpSpring.current.y += jumpSpring.current.velocity;

      // 2. 左右にてくてく歩くアニメーション (Left-Right Walk)
      let isWalking = false;
      let walkDir = 1;

      if (isCelebrating) {
        // 大喜び時：嬉しくて左右にピョンピョン跳ね回る！
        const danceX = Math.sin(t * 5) * 28;
        currentWalkX.current = danceX;
        walkDir = Math.cos(t * 5) >= 0 ? 1 : -1;
      } else {
        // 通常時：トコトコ左右をお散歩・パトロール
        pauseTimer.current -= dt;
        if (pauseTimer.current <= 0) {
          // 新しい目的地（-32px 〜 +32px の間でランダム決定）
          walkTarget.current = (Math.random() - 0.5) * 64;
          pauseTimer.current = 2.5 + Math.random() * 3.5;
        }

        const dx = walkTarget.current - currentWalkX.current;
        if (Math.abs(dx) > 1.5) {
          isWalking = true;
          walkDir = dx > 0 ? 1 : -1;
          const speed = 28 * dt; // 秒速28pxの穏やかなてくてく歩き
          currentWalkX.current += Math.sign(dx) * Math.min(Math.abs(dx), speed);
          walkPhase.current += dt * 10; // 足踏みスピード
        } else {
          isWalking = false;
          walkDir = mousePos.current.x >= 0 ? 1 : -1;
        }
      }

      // 3. 足踏みと体の揺れ（てくてくペンギン歩き）
      let leftFootY = 0;
      let rightFootY = 0;
      let bodyTilt = 0;

      if (isWalking || isCelebrating) {
        const step = Math.sin(walkPhase.current);
        leftFootY = Math.max(0, step * 7);
        rightFootY = Math.max(0, -step * 7);
        bodyTilt = step * 4.5 * walkDir; // 歩く方向に体がリズミカルに傾く
      } else {
        // アイドル時の微細なリズム揺れ
        bodyTilt = Math.sin(t * 1.8) * 1.5;
      }

      // 4. ぷにぷに呼吸（Squash & Stretch）
      const breath = Math.sin(t * 2.6);
      const breathScaleY = 1 + breath * 0.035 - jumpSpring.current.y * 0.008;
      const breathScaleX = 1 - breath * 0.025 + jumpSpring.current.y * 0.005;

      // 5. 頭のふたば（双葉）のスプリング物理揺れ
      const sproutInertia = isWalking ? Math.sin(walkPhase.current) * 8 : Math.sin(t * 2.6) * 4;
      const sproutAngle = sproutInertia - jumpSpring.current.velocity * 0.6;

      // 6. 手の動き（通常はパタパタ手を振る、正解時は全力拍手パチパチ！）
      let rightArmAngle = 0;
      let leftArmAngle = 0;

      if (isCelebrating) {
        // 大喜び：両手バンザイ＆パチパチ拍手！
        const clapCycle = Math.sin(t * 12);
        rightArmAngle = -50 + clapCycle * 25;
        leftArmAngle = 50 - clapCycle * 25;
      } else if (mood === "think") {
        // 考え中：右手があごのあたりにちょこん
        rightArmAngle = -45 + Math.sin(t * 2) * 4;
        leftArmAngle = 10;
      } else {
        // 通常：右手を上げて「おーい！」と可愛くパタパタ手を振る
        const wave = Math.sin(t * 3.8);
        rightArmAngle = -28 + wave * 18;
        leftArmAngle = Math.sin(t * 2.6) * 6;
      }

      // 7. まばたき
      blinkTimer.current += dt;
      let blinkScale = 1;
      if (!isBlinking.current && blinkTimer.current > 2.8 + Math.random() * 2.5) {
        isBlinking.current = true;
        blinkTimer.current = 0;
      }
      if (isBlinking.current) {
        blinkScale = 0.1;
        if (blinkTimer.current > 0.14) {
          isBlinking.current = false;
          blinkScale = 1;
        }
      }

      // 8. 視線追従
      const eyeOffsetX = mousePos.current.x * 4.0;
      const eyeOffsetY = mousePos.current.y * 2.5;

      // 9. 空中回転スピン（大ジャンプ時）
      const spinDeg = isCelebrating && jumpSpring.current.y < -12 ? Math.sin(t * 8) * 15 : 0;

      setFrame({
        walkX: currentWalkX.current,
        walkDirection: walkDir,
        bodyTilt,
        breathScaleY,
        breathScaleX,
        leftFootY,
        rightFootY,
        sproutAngle,
        rightArmAngle,
        leftArmAngle,
        eyeOffsetX,
        eyeOffsetY,
        blinkScale,
        jumpY: jumpSpring.current.y,
        spinDeg,
        isCelebrating,
        isSpeaking: isSpeakingRef.current,
        animTime: t,
      });
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [mood, propCelebrating]);

  // クリック・タップ反応
  const handleTap = () => {
    jumpSpring.current.velocity = -26;
    celebrateTimer.current = 1.8;
    if (onClick) onClick();
  };

  const hat = accessories?.hat || "hat_none";
  const glasses = accessories?.glasses || "glasses_none";

  return (
    <div
      ref={containerRef}
      className={className}
      onClick={handleTap}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        cursor: "pointer",
      }}
      title="クリックしてあそんでね！"
    >
      {/* 左右にてくてく歩く位置オフセット & ジャンプ */}
      <div
        style={{
          transform: `translate(${frame.walkX}px, ${frame.jumpY}px) rotate(${frame.spinDeg}deg)`,
          transition: "transform 0.04s linear",
          width: "170px",
          height: "190px",
          position: "relative",
        }}
      >
        <svg
          viewBox="0 0 170 190"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%",
            height: "100%",
            overflow: "visible",
            filter: "drop-shadow(0 12px 22px rgba(13, 159, 140, 0.22))",
          }}
        >
          <defs>
            {/* メインボディ：みずみずしく優しいエメラルドミント */}
            <linearGradient id="lovableMintGrad" x1="20" y1="20" x2="150" y2="160" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="45%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* 大喜び時の温かいサニーコーラルグラデーション */}
            <linearGradient id="lovableCelebrateGrad" x1="20" y1="20" x2="150" y2="160" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="50%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>

            {/* 考え中の優しいラベンダースカイ */}
            <linearGradient id="lovableThinkGrad" x1="20" y1="20" x2="150" y2="160" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>

            {/* 頭の元気なふたば（双葉） */}
            <linearGradient id="sproutGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bef264" />
              <stop offset="100%" stopColor="#65a30d" />
            </linearGradient>

            {/* ぽってりお腹のクリームホワイト */}
            <linearGradient id="bellyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#f0fdf4" stopOpacity="0.8" />
            </linearGradient>

            {/* うるうるの瞳のグラデーション */}
            <linearGradient id="eyeDeepGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="70%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* 1. 地面のやわらかな楕円シャドウ（ジャンプで縮小・着地で拡大） */}
          <ellipse
            cx="85"
            cy="176"
            rx={Math.max(16, 44 + frame.jumpY * 0.4)}
            ry={Math.max(3, 7 + frame.jumpY * 0.07)}
            fill="rgba(15, 23, 42, 0.15)"
          />

          {/* 2. てくてく歩くあんよ（Left & Right Feet） */}
          <g>
            {/* 左足 */}
            <ellipse
              cx="64"
              cy={168 - frame.leftFootY}
              rx="12"
              ry="7.5"
              fill="#ffffff"
              stroke="#0f766e"
              strokeWidth="2.8"
            />
            {/* 右足 */}
            <ellipse
              cx="106"
              cy={168 - frame.rightFootY}
              rx="12"
              ry="7.5"
              fill="#ffffff"
              stroke="#0f766e"
              strokeWidth="2.8"
            />
          </g>

          {/* 3. キャラクター本体（呼吸＆歩行チルト） */}
          <g
            transform={`translate(85, 115) rotate(${frame.bodyTilt}) scale(${frame.breathScaleX}, ${frame.breathScaleY}) translate(-85, -115)`}
          >
            {/* ころんとした丸みのある愛されボディ */}
            <path
              d="M32 95 C30 52 54 38 85 38 C116 38 140 52 138 95 C136 138 116 162 85 162 C54 162 34 138 32 95 Z"
              fill={
                frame.isCelebrating
                  ? "url(#lovableCelebrateGrad)"
                  : mood === "think"
                  ? "url(#lovableThinkGrad)"
                  : "url(#lovableMintGrad)"
              }
              stroke="#ffffff"
              strokeWidth="5"
            />

            {/* ぽってり優しいお腹のハイライト */}
            <ellipse cx="85" cy="116" rx="36" ry="34" fill="url(#bellyGrad)" />

            {/* ほんのり桜色のぽわぽわチーク */}
            <ellipse cx="51" cy="98" rx="8.5" ry="5.5" fill="#ff7694" opacity="0.75" />
            <line x1="48" y1="99" x2="51" y2="95" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="52" y1="99" x2="55" y2="95" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />

            <ellipse cx="119" cy="98" rx="8.5" ry="5.5" fill="#ff7694" opacity="0.75" />
            <line x1="116" y1="99" x2="119" y2="95" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="120" y1="99" x2="123" y2="95" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />

            {/* ========================================================
                お顔の表情（瞳・おくち）
                ======================================================== */}
            {frame.isCelebrating ? (
              // 大喜び時の満面の笑顔（^ ^）
              <g>
                <path
                  d="M54 84 Q63 72 72 84"
                  stroke="#ffffff"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M98 84 Q107 72 116 84"
                  stroke="#ffffff"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* 大きく開けた楽しそうなおくち */}
                <path d="M73 95 Q85 116 97 95 Z" fill="#be123c" stroke="#ffffff" strokeWidth="2.2" />
                <path d="M78 102 Q85 112 92 102" fill="#fb7185" />
              </g>
            ) : mood === "think" ? (
              // 考え中のきょとんとした表情
              <g>
                <circle cx="63" cy="80" r="7.5" fill="url(#eyeDeepGrad)" />
                <circle cx="66" cy="77" r="2.8" fill="#ffffff" />
                <circle cx="107" cy="80" r="7.5" fill="url(#eyeDeepGrad)" />
                <circle cx="110" cy="77" r="2.8" fill="#ffffff" />
                {/* ちょこんとおちょぼ口 */}
                <ellipse cx="85" cy="98" rx="4.5" ry="5.5" fill="#0f172a" />
              </g>
            ) : (
              // 通常の愛くるしい大きな瞳（視線追従＆まばたき）
              <g>
                {/* 左目 */}
                <g transform={`translate(63, 82) scale(1, ${frame.blinkScale}) translate(-63, -82)`}>
                  <ellipse cx="63" cy="82" rx="8" ry="10" fill="url(#eyeDeepGrad)" />
                  <g transform={`translate(${frame.eyeOffsetX * 0.4}, ${frame.eyeOffsetY * 0.4})`}>
                    <circle cx="61" cy="79" r="3.2" fill="#ffffff" />
                    <circle cx="66" cy="86" r="1.4" fill="#67e8f9" />
                  </g>
                </g>

                {/* 右目 */}
                <g transform={`translate(107, 82) scale(1, ${frame.blinkScale}) translate(-107, -82)`}>
                  <ellipse cx="107" cy="82" rx="8" ry="10" fill="url(#eyeDeepGrad)" />
                  <g transform={`translate(${frame.eyeOffsetX * 0.4}, ${frame.eyeOffsetY * 0.4})`}>
                    <circle cx="105" cy="79" r="3.2" fill="#ffffff" />
                    <circle cx="110" cy="86" r="1.4" fill="#67e8f9" />
                  </g>
                </g>

                {/* おくち（発話中はリップシンクでパクパク話す！） */}
                {frame.isSpeaking ? (
                  <g>
                    <ellipse
                      cx="85"
                      cy="98"
                      rx="5"
                      ry={3 + Math.abs(Math.sin(frame.animTime * 14)) * 3.5}
                      fill="#0f172a"
                    />
                    <ellipse
                      cx="85"
                      cy="99.5"
                      rx="3"
                      ry={1.5 + Math.abs(Math.sin(frame.animTime * 14)) * 1.5}
                      fill="#fb7185"
                    />
                  </g>
                ) : (
                  <path
                    d="M77 96 Q85 105 93 96"
                    stroke="#0f172a"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </g>
            )}

            {/* ========================================================
                小さなお手て（パタパタ手を振る / 拍手する）
                ======================================================== */}
            {/* 左手 */}
            <g transform={`translate(35, 108) rotate(${frame.leftArmAngle}) translate(-35, -108)`}>
              <ellipse cx="27" cy="110" rx="9" ry="7" fill="#ffffff" stroke="#0f766e" strokeWidth="2.8" />
            </g>

            {/* 右手（元気に手を振る！） */}
            <g transform={`translate(135, 108) rotate(${frame.rightArmAngle}) translate(-135, -108)`}>
              <ellipse cx="143" cy="110" rx="9" ry="7" fill="#ffffff" stroke="#0f766e" strokeWidth="2.8" />
            </g>

            {/* ========================================================
                頭のシンボル：元気なふたば（双葉）
                ======================================================== */}
            <g transform={`translate(85, 40) rotate(${frame.sproutAngle}) translate(-85, -40)`}>
              {/* 茎 */}
              <path d="M85 42 Q85 30 85 24" stroke="#65a30d" strokeWidth="3" strokeLinecap="round" />
              {/* 左葉っぱ */}
              <path
                d="M85 26 C75 14 62 20 66 30 C72 34 82 28 85 26 Z"
                fill="url(#sproutGrad)"
                stroke="#4d7c0f"
                strokeWidth="1.8"
              />
              {/* 右葉っぱ */}
              <path
                d="M85 26 C95 14 108 20 104 30 C98 34 88 28 85 26 Z"
                fill="url(#sproutGrad)"
                stroke="#4d7c0f"
                strokeWidth="1.8"
              />
              <circle cx="85" cy="24" r="2.5" fill="#bef264" />
            </g>

            {/* 着せ替えアクセサリ（帽子） */}
            {hat === "hat_beret" && (
              <g transform="translate(85, 34) rotate(-8)">
                <ellipse cx="0" cy="0" rx="26" ry="12" fill="#dc2626" stroke="#ffffff" strokeWidth="2.2" />
                <line x1="0" y1="-12" x2="2" y2="-17" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            )}
            {hat === "hat_crown" && (
              <g transform="translate(85, 32)">
                <path d="M-18 2 L-15 -10 L-8 -3 L0 -14 L8 -3 L15 -10 L18 2 Z" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                <circle cx="-15" cy="-10" r="2" fill="#ef4444" />
                <circle cx="0" cy="-14" r="2.4" fill="#3b82f6" />
                <circle cx="15" cy="-10" r="2" fill="#ef4444" />
              </g>
            )}
            {hat === "hat_ribbon" && (
              <g transform="translate(85, 36)">
                <ellipse cx="-12" cy="0" rx="9" ry="6" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.8" />
                <ellipse cx="12" cy="0" rx="9" ry="6" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.8" />
                <circle cx="0" cy="0" r="4.5" fill="#fb7185" stroke="#ffffff" strokeWidth="1.8" />
              </g>
            )}

            {/* 着せ替えアクセサリ（メガネ） */}
            {glasses === "glasses_round" && (
              <g transform="translate(85, 82)">
                <circle cx="-22" cy="0" r="11" fill="none" stroke="#d97706" strokeWidth="2.2" />
                <circle cx="22" cy="0" r="11" fill="none" stroke="#d97706" strokeWidth="2.2" />
                <path d="M-11 0 Q0 -2 11 0" stroke="#d97706" strokeWidth="2.2" fill="none" />
              </g>
            )}
          </g>

          {/* 4. 大喜び・正解時のキラキラ星屑エフェクト */}
          {frame.isCelebrating && (
            <g opacity="0.95">
              <text x={18 + Math.sin(frame.animTime * 6) * 6} y={40} fontSize="20" fill="#facc15">✦</text>
              <text x={138 + Math.cos(frame.animTime * 6) * 6} y={48} fontSize="22" fill="#facc15">★</text>
              <text x={12 + Math.cos(frame.animTime * 5) * 5} y={130} fontSize="18" fill="#38bdf8">✨</text>
              <text x={142 + Math.sin(frame.animTime * 5) * 5} y={125} fontSize="18" fill="#fb7185">💖</text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
