"use client";

import Link from "next/link";
import type { Route } from "next";
import { Lock, Sparkles, Trophy } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import { RubyAuto } from "@/components/child/RubyText";
import { getCurriculumStages } from "@/lib/curriculum/curriculumBank";
import { SUBJECT_CONFIG, type Subject } from "@/lib/curriculum/subjects";

interface CurriculumStageSectionProps {
  currentSubject: Subject;
  childId?: string;
  readingMode?: "kanji_with_ruby" | "hiragana";
  /** いちどでも正解した問題バンクの id(ログイン中のみ) */
  solvedIds?: readonly string[];
}

export function CurriculumStageSection({
  currentSubject,
  childId,
  readingMode = "kanji_with_ruby",
  solvedIds = [],
}: CurriculumStageSectionProps) {
  const stages = getCurriculumStages(currentSubject);
  const solved = new Set(solvedIds);

  // 教科内の累計クリア問題数
  const totalSolvedInSubject = stages.reduce(
    (acc, stage) => acc + stage.problemIds.filter((id) => solved.has(id)).length,
    0,
  );
  const totalProblemsInSubject = stages.reduce((acc, stage) => acc + stage.problemCount, 0);

  return (
    <section className={styles.stageMapSection} aria-label="カリキュラムステージ">
      <div className={styles.stageMapHeader}>
        <div>
          <h2 className={styles.stageMapTitle}>
            <span>🗺️</span>
            <span>カリキュラム ステージマップ</span>
          </h2>
          <p className={styles.stageMapSubtitle}>
            {`クリアしていくと、あたらしい ステージや もんだいが どんどん ふえるよ！`}
          </p>
        </div>
      </div>

      {/* プログレッション解放ゲージ */}
      <div
        style={{
          background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
          border: "2px solid #fdba74",
          borderRadius: "16px",
          padding: "1rem",
          marginBottom: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Trophy size={20} color="#ea580c" />
            <strong style={{ fontSize: "0.95rem", color: "#9a3412" }}>
              ステージ かいほう ゲージ: {totalSolvedInSubject} / {totalProblemsInSubject} もん クリア
            </strong>
          </div>
          <span style={{ fontSize: "0.85rem", color: "#c2410c", fontWeight: 600 }}>
            {totalSolvedInSubject >= totalProblemsInSubject ? "🎉 ぜんぶ クリア！" : "もんだいを とくと 増えるよ！"}
          </span>
        </div>
        <div
          style={{
            height: "10px",
            background: "#fed7aa",
            borderRadius: "999px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.round((totalSolvedInSubject / Math.max(1, totalProblemsInSubject)) * 100))}%`,
              background: "linear-gradient(90deg, #f97316 0%, #ea580c 100%)",
              borderRadius: "999px",
              transition: "width 0.4s ease-out",
            }}
          />
        </div>
      </div>

      <div className={styles.stageGrid}>
        {stages.map((stage) => {
          const solvedCount = stage.problemIds.filter((id) => solved.has(id)).length;
          const cleared = solvedCount === stage.problemCount;
          const isUnlocked = totalSolvedInSubject >= stage.unlockRequirement;
          const isNewlyUnlocked =
            isUnlocked &&
            stage.unlockRequirement > 0 &&
            totalSolvedInSubject <= stage.unlockRequirement + 2;
          const remainingToUnlock = stage.unlockRequirement - totalSolvedInSubject;

          // つづきから: まだ正解していない最初の問題へ
          const nextId = stage.problemIds.find((id) => !solved.has(id)) ?? stage.firstProblemId;
          const href = `/child/problem/${nextId}${childId ? `?childId=${childId}` : ""}`;

          if (!isUnlocked) {
            return (
              <div
                key={stage.id}
                className={styles.stageCard}
                style={{
                  opacity: 0.65,
                  filter: "grayscale(0.4)",
                  background: "#f8fafc",
                  borderColor: "#cbd5e1",
                  cursor: "not-allowed",
                }}
                aria-disabled="true"
              >
                <div className={styles.stageCardTop}>
                  <span className={styles.stageCardEmoji} role="img" aria-label={stage.title}>
                    🔒
                  </span>
                  <span className={styles.stageCardBadge} style={{ background: "#94a3b8", color: "#fff" }}>
                    あと {remainingToUnlock}もん
                  </span>
                </div>

                <h3 className={styles.stageCardTitle}>
                  <RubyAuto text={stage.title} readingMode={readingMode} />
                </h3>

                <p className={styles.stageCardDesc}>
                  もんだいを クリアしていくと、このステージが かいほう されるよ！
                </p>

                <div
                  className={styles.stageCardAction}
                  style={{ color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Lock size={16} /> ロック中
                </div>
              </div>
            );
          }

          return (
            <Link
              key={stage.id}
              href={href as Route}
              className={`${styles.stageCard} ${cleared ? styles.stageCardCleared : ""}`}
              title={`${stage.title}をはじめよう`}
              style={
                isNewlyUnlocked
                  ? {
                      borderColor: "#f59e0b",
                      boxShadow: "0 0 12px rgba(245, 158, 11, 0.35)",
                    }
                  : undefined
              }
            >
              <div className={styles.stageCardTop}>
                <span className={styles.stageCardEmoji} role="img" aria-label={stage.title}>
                  {stage.emoji}
                </span>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  {isNewlyUnlocked && (
                    <span
                      style={{
                        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        color: "#fff",
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                    >
                      <Sparkles size={12} /> NEW!
                    </span>
                  )}
                  <span
                    className={cleared ? styles.stageCardBadgeCleared : styles.stageCardBadge}
                    aria-label={`${stage.problemCount}もん中 ${solvedCount}もん できた`}
                  >
                    {cleared ? "⭐ クリア" : solvedCount > 0 ? `${solvedCount}/${stage.problemCount}` : `${stage.problemCount}もん`}
                  </span>
                </div>
              </div>

              <h3 className={styles.stageCardTitle}>
                <RubyAuto text={stage.title} readingMode={readingMode} />
              </h3>

              <p className={styles.stageCardDesc}>{stage.description}</p>

              <div className={styles.stageCardAction}>
                {cleared ? "もういちど ▶" : solvedCount > 0 ? "つづきから ▶" : "べんきょうする ▶"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
