"use client";

import { useEffect } from "react";
import styles from "@/components/kanoha.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import { CharacterCoach } from "./CharacterCoach";
import { HandwritingPad } from "./HandwritingPad";
import { HintStepper } from "./HintStepper";
import { RubyAuto } from "./RubyText";
import { FLOW_TEXT } from "./childStrings";
import { FinishedScreen, LimitScreen, PracticeFlow } from "./PracticeFlow";
import { VoiceAnswer } from "./VoiceAnswer";
import { VoiceButton } from "./VoiceButton";
import {
  useLearningFlow,
  type LearningPreferences,
  type PersistedProblem,
} from "./useLearningFlow";

const DEFAULT_PREFERENCES: LearningPreferences = {
  enableAudio: true,
  enableVoiceAnswer: true,
  readingMode: "kanji_with_ruby",
};

/**
 * 学習フローの画面(状態とAPIは useLearningFlow に集約)。
 * 元問題 → 段階式ヒント → 類題5問 → 結果、の順に切り替える。
 */
export function LearningFlow({
  persisted,
  preferences = DEFAULT_PREFERENCES,
}: {
  persisted?: PersistedProblem;
  preferences?: LearningPreferences;
}) {
  const flow = useLearningFlow(persisted);
  const isJapanese =
    persisted?.subject === "japanese" ||
    flow.unit === "漢字" ||
    flow.unit === "お話の読解" ||
    flow.unit === "ことばのきまり";

  // 教科に応じた BGM の自動開始 & 終了
  useEffect(() => {
    if (!preferences.enableAudio) return;
    if (flow.finished) {
      soundManager.startBgm("celebrate");
    } else {
      soundManager.startBgm(isJapanese ? "japanese" : "math");
    }
    return () => {
      soundManager.stopBgm();
    };
  }, [flow.finished, isJapanese, preferences.enableAudio]);

  if (flow.dailyLimit) return <LimitScreen usedMinutes={flow.dailyLimit.usedMinutes} />;
  if (flow.finished) {
    return (
      <FinishedScreen
        readingMode={preferences.readingMode}
        resultHref={flow.resultHref}
        score={flow.score}
        unit={flow.unit}
        onRestart={() => void flow.restartFlow()}
      />
    );
  }
  if (flow.practiceIndex !== null) {
    return (
      <PracticeFlow
        practiceIndex={flow.practiceIndex}
        problems={flow.similarProblems}
        readingMode={preferences.readingMode}
        score={flow.score}
        onAnswer={persisted ? flow.answerSimilar : undefined}
        onComplete={(correct) => void flow.completeSimilar(correct)}
      />
    );
  }

  return (
    <>
      <section className={styles.problemCard}>
        <div className={styles.quizTop}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 800,
                padding: "3px 10px",
                borderRadius: "99px",
                background: isJapanese ? "#fff0ee" : "#e6f7f4",
                color: isJapanese ? "#cf3a2e" : "#076d5f",
                border: `1px solid ${isJapanese ? "#ffc9c4" : "#bcebe3"}`,
              }}
            >
              {isJapanese ? "📖 こくご" : "🧮 さんすう"}
            </span>
            <span className={styles.problemNumber}>{FLOW_TEXT.recommendedLabel}</span>
          </div>
          {preferences.enableAudio ? <VoiceButton text={flow.question} /> : null}
        </div>
        <h1 className={styles.problemText}>
          <RubyAuto text={flow.question} readingMode={preferences.readingMode} excludeBrackets />
        </h1>
        <div className={styles.answerRow}>
          <input
            aria-label="こたえ"
            className={styles.answerInput}
            inputMode={isJapanese ? "text" : "numeric"}
            placeholder={isJapanese ? "こたえ" : "すうじ"}
            value={flow.answer}
            onChange={(event) => flow.setAnswer(event.target.value)}
          />
          <button
            className={styles.primaryButton}
            disabled={!flow.answer || flow.pending}
            type="button"
            onClick={() => void flow.checkOriginalAnswer()}
          >
            {FLOW_TEXT.answerButton}
          </button>
          {preferences.enableVoiceAnswer ? <VoiceAnswer onAnswer={flow.setAnswer} /> : null}
          {persisted ? (
            <HandwritingPad
              childId={persisted.childId}
              onAnswer={flow.setAnswer}
              problemId={persisted.problemId}
              subject={isJapanese ? "japanese" : "math"}
            />
          ) : null}
        </div>
        {flow.checked ? (
          <div className={flow.checked.correct ? styles.feedback : styles.feedbackWrong}>
            {flow.checked.correct ? FLOW_TEXT.correctFeedback : FLOW_TEXT.wrongFeedback}
          </div>
        ) : null}
        <HintStepper
          revealed={flow.revealedHints}
          onRequestNext={flow.requestNextHint}
          readingMode={preferences.readingMode}
          onSimplify={persisted ? () => void flow.simplifyHints() : undefined}
          simplifying={flow.simplifying}
          onVisual={() => void flow.showVisualHint()}
          visualPending={flow.visualPending}
          visualUrl={flow.visualUrl}
        />
        <div className={styles.hintActions}>
          <button
            className={styles.secondaryButton}
            disabled={flow.pending}
            type="button"
            onClick={() => void flow.startPractice()}
          >
            {flow.pending ? FLOW_TEXT.preparing : FLOW_TEXT.practiceButton}
          </button>
        </div>
        {flow.saveMessage ? <p className={styles.feedbackWrong}>{flow.saveMessage}</p> : null}
        {flow.retryAction ? (
          <button className={styles.secondaryButton} type="button" onClick={flow.retryAction}>
            {FLOW_TEXT.retry}
          </button>
        ) : null}
      </section>
      <CharacterCoach
        message={
          flow.checked?.correct
            ? "やったぁ！だいせいかい！すごいねっ✨"
            : flow.checked
            ? "おしい！もういっかい かんがえてみよう！"
            : FLOW_TEXT.coachThink
        }
        mood={flow.checked?.correct ? "celebrate" : "think"}
      />
    </>
  );
}
