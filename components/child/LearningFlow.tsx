"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
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
        nextProblemHref={flow.nextProblemHref}
        score={flow.score}
        unit={flow.unit}
        onRestart={() => void flow.restartFlow()}
      />
    );
  }
  if (flow.practiceIndex !== null) {
    return (
      <div className={styles.learningGrid}>
        <div className={styles.learningCoachCol}>
          <CharacterCoach
            message="れんしゅうも いっしょに がんばろうっ♪"
            mood="happy"
          />
        </div>
        <div className={styles.learningCardCol}>
          <PracticeFlow
            practiceIndex={flow.practiceIndex}
            problems={flow.similarProblems}
            readingMode={preferences.readingMode}
            score={flow.score}
            onAnswer={persisted ? flow.answerSimilar : undefined}
            onComplete={(correct) => void flow.completeSimilar(correct)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.learningGrid}>
      <div className={styles.learningCoachCol}>
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
      </div>

      <div className={styles.learningCardCol}>
        <section className={styles.learningProblemCard}>
          <div className={styles.problemScroll}>
            <div className={styles.learningHeaderRow}>
              <div className={styles.badgeGroup}>
                <span
                  className={
                    isJapanese ? styles.subjectBadgeJapanese : styles.subjectBadgeMath
                  }
                >
                  {isJapanese ? "📖 こくご" : "🧮 さんすう"}
                </span>
                <span className={styles.problemNumber}>{FLOW_TEXT.recommendedLabel}</span>
              </div>
              {preferences.enableAudio ? <VoiceButton text={flow.question} /> : null}
            </div>

            <h1 className={styles.compactProblemText}>
              <RubyAuto text={flow.question} readingMode={preferences.readingMode} excludeBrackets />
            </h1>

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
          </div>

          <AnswerDock
            flow={flow}
            isJapanese={isJapanese}
            persisted={persisted}
            enableVoiceAnswer={preferences.enableVoiceAnswer}
          />
        </section>
      </div>
    </div>
  );
}

type Flow = ReturnType<typeof useLearningFlow>;

/**
 * 回答エリア(結果・入力・キーパッド)。スマホでは画面下に固定され、
 * 問題文とヒントだけがその上でスクロールする(ページ全体は縦スクロールしない)。
 */
function AnswerDock({
  flow,
  isJapanese,
  persisted,
  enableVoiceAnswer,
}: {
  flow: Flow;
  isJapanese: boolean;
  persisted?: PersistedProblem;
  enableVoiceAnswer: boolean;
}) {
  const hasTools = enableVoiceAnswer || Boolean(persisted);
  return (
    <div className={styles.answerDock}>
      {flow.checked ? (
        <div className={flow.checked.correct ? styles.feedback : styles.feedbackWrong} role="status">
          {flow.checked.correct ? (
            <span className={styles.feedbackStrong}>🎉 {FLOW_TEXT.correctFeedback}</span>
          ) : (
            FLOW_TEXT.wrongFeedback
          )}
        </div>
      ) : null}

      {flow.checked?.correct && flow.nextProblemHref ? (
        <Link href={flow.nextProblemHref as Route} className={styles.nextProblemButton}>
          🚀 つぎの もんだいへ すすむ！
        </Link>
      ) : null}

      <div className={styles.learningInputRow}>
        <input
          aria-label="こたえ"
          className={styles.learningDisplayInput}
          inputMode={isJapanese ? "text" : "numeric"}
          placeholder={isJapanese ? "こたえを 入力 または 手書き" : "こたえ"}
          value={flow.answer}
          onChange={(event) => flow.setAnswer(event.target.value)}
        />
        <button
          className={styles.toyAnswerButton}
          disabled={!flow.answer || flow.pending}
          type="button"
          onClick={() => void flow.checkOriginalAnswer()}
        >
          {FLOW_TEXT.answerButton}
        </button>
      </div>

      {hasTools ? (
        <div className={styles.learningActionBtns}>
          {enableVoiceAnswer ? <VoiceAnswer onAnswer={flow.setAnswer} /> : null}
          {persisted ? (
            <HandwritingPad
              childId={persisted.childId}
              onAnswer={flow.setAnswer}
              onSubmitAnswer={(ans) => void flow.checkOriginalAnswer(ans)}
              problemId={persisted.problemId}
              subject={isJapanese ? "japanese" : "math"}
            />
          ) : null}
        </div>
      ) : null}

      {/* 算数用 オンスクリーン・トイテンキー (タップでカンタン入力) */}
      {!isJapanese && !flow.checked?.correct ? (
        <div className={styles.toyKeypad} aria-label="数字キーパッド">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
            <button
              key={num}
              type="button"
              className={styles.keypadKey}
              onClick={() => flow.setAnswer((prev) => prev + num.toString())}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.keypadKey} ${styles.keypadKeyAction} ${styles.keypadBack}`}
            onClick={() => flow.setAnswer((prev) => prev.slice(0, -1))}
            title="1文字消す"
          >
            ⌫
          </button>
          <button
            type="button"
            className={`${styles.keypadKey} ${styles.keypadKeyAction} ${styles.keypadClear}`}
            onClick={() => flow.setAnswer("")}
            title="ぜんぶ消す"
          >
            クリア
          </button>
        </div>
      ) : null}
    </div>
  );
}
