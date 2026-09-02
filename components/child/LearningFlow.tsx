"use client";

import styles from "@/components/kanoha.module.css";
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
          <span className={styles.problemNumber}>{FLOW_TEXT.recommendedLabel}</span>
          {preferences.enableAudio ? <VoiceButton text={flow.question} /> : null}
        </div>
        <h1 className={styles.problemText}>
          <RubyAuto text={flow.question} readingMode={preferences.readingMode} />
        </h1>
        <div className={styles.answerRow}>
          <input
            aria-label="こたえ"
            className={styles.answerInput}
            inputMode="numeric"
            placeholder="すうじ"
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
            <HandwritingPad childId={persisted.childId} onAnswer={flow.setAnswer} problemId={persisted.problemId} />
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
      <CharacterCoach message={FLOW_TEXT.coachThink} mood="think" />
    </>
  );
}
