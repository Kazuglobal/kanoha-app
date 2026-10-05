"use client";

import { useEffect } from "react";
import type { Route } from "next";
import Link from "next/link";
import styles from "@/components/kanoha.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import { speakCoachVoice } from "@/lib/audio/coachSpeech";
import { CharacterCoach } from "./CharacterCoach";
import { RubyAuto } from "./RubyText";
import { FLOW_TEXT } from "./childStrings";
import {
  SimilarProblemCard,
  type SimilarAnswerResult,
  type SimilarProblem,
} from "./SimilarProblemCard";

type ReadingMode = "kanji_with_ruby" | "hiragana";

/** 利用時間の上限に達したときの「きょうは ここまで！」画面。 */
export function LimitScreen({ usedMinutes }: { usedMinutes: number }) {
  return (
    <section className={`${styles.card} ${styles.resultHero}`}>
      <CharacterCoach message={FLOW_TEXT.limitCoach} mood="celebrate" />
      <h1 className={styles.pageTitle}>{FLOW_TEXT.limitTitle}</h1>
      <p className={styles.lead}>
        {FLOW_TEXT.limitLeadPrefix}{usedMinutes}{FLOW_TEXT.limitLeadSuffix}
      </p>
      <Link className={styles.primaryButton} href="/child/home">{FLOW_TEXT.backHome}</Link>
    </section>
  );
}

/** 類題 5 問が終わったあとの画面。「もういちど やる」(doc §6.1)を出す。 */
export function FinishedScreen({
  score,
  unit,
  readingMode,
  resultHref,
  nextProblemHref,
  onRestart,
}: {
  score: number;
  unit: string;
  readingMode: ReadingMode;
  resultHref: string;
  nextProblemHref?: string | null;
  onRestart: () => void;
}) {
  useEffect(() => {
    soundManager.playCelebrate();
    if (score >= 4) {
      void speakCoachVoice("ぜんぶ できたね！すごいっ！", "celebrate");
    } else {
      void speakCoachVoice("よく がんばったね！つぎも いっしょに やろう！", "happy");
    }
  }, [score]);

  const mastered = score >= 4;
  return (
    <section className={`${styles.card} ${styles.resultHero}`}>
      <CharacterCoach
        message={mastered ? FLOW_TEXT.finishedCoachGreat : FLOW_TEXT.finishedCoachTry}
        mood="celebrate"
      />
      <h1 className={styles.pageTitle}>
        {mastered ? FLOW_TEXT.finishedGreat : FLOW_TEXT.finishedRetryTitle}
      </h1>
      <p className={styles.score}>{score}/5</p>
      <p className={styles.lead}>
        <RubyAuto text={unit} readingMode={readingMode} />
        {FLOW_TEXT.finishedLeadSuffix}
      </p>
      <div className={`${styles.hintActions} ${styles.resultActions}`}>
        {nextProblemHref && (
          <Link className={styles.nextProblemButton} href={nextProblemHref as Route}>
            🚀 つぎの もんだいへ すすむ！
          </Link>
        )}
        <Link className={styles.primaryButton} href={resultHref as Route}>{FLOW_TEXT.resultLink}</Link>
        <button className={styles.secondaryButton} type="button" onClick={onRestart}>
          {FLOW_TEXT.retryFlow}
        </button>
      </div>
    </section>
  );
}

/** 類題 5 問の出題部分。1 問ずつ SimilarProblemCard を出す。 */
export function PracticeFlow({
  problems,
  practiceIndex,
  score,
  readingMode,
  onAnswer,
  onComplete,
}: {
  problems: readonly SimilarProblem[];
  practiceIndex: number;
  score: number;
  readingMode: ReadingMode;
  onAnswer?: (answer: string) => Promise<SimilarAnswerResult | null>;
  onComplete: (correct: boolean) => void;
}) {
  return (
    <SimilarProblemCard
      index={practiceIndex}
      key={practiceIndex}
      problem={problems[practiceIndex]}
      readingMode={readingMode}
      score={score}
      total={problems.length}
      onAnswer={onAnswer}
      onComplete={(correct) => onComplete(correct)}
    />
  );
}
