"use client";

import { useState } from "react";
import styles from "@/components/kanoha.module.css";
import { answersMatch } from "@/lib/utils/answers";
import { soundManager } from "@/lib/audio/soundSystem";
import { playPraiseVoice, playEncourageVoice } from "@/lib/audio/coachSpeech";
import { RubyAuto } from "./RubyText";

export type SimilarProblem = {
  question: string;
  /** サーバーが作った 4 択。null のときは文字入力にフォールバックする。 */
  choices: readonly string[] | null;
  /** デモ専用(Supabase 未設定)。実データでは渡さず、正誤は /api/attempts が返す。 */
  answer?: string;
  explanation?: string;
};

export interface SimilarAnswerResult {
  correct: boolean;
  explanation?: string | null;
}

const RETRY_MESSAGE = "こたえを おくれなかったよ。";
const RETRY_BUTTON = "もういちど ためす";
const ENCOURAGE = "つぎは いっしょに かんがえよう。";

export function SimilarProblemCard({
  problem,
  index,
  total,
  score,
  readingMode = "kanji_with_ruby",
  onAnswer,
  onComplete,
}: {
  problem: SimilarProblem;
  index: number;
  total: number;
  score: number;
  readingMode?: "kanji_with_ruby" | "hiragana";
  onAnswer?: (answer: string) => Promise<SimilarAnswerResult | null>;
  onComplete: (correct: boolean, selectedAnswer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<SimilarAnswerResult | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);

  async function submit(answer: string) {
    if (pending || selected !== null) return;
    soundManager.playTap();
    setMessage("");
    setSelected(answer);
    setLastAttempt(answer);
    if (problem.answer !== undefined) {
      const isCorrect = answersMatch(answer, problem.answer);
      if (isCorrect) {
        soundManager.playCorrect();
        void playPraiseVoice();
      } else {
        soundManager.playWrong();
        void playEncourageVoice();
      }
      setResult({ correct: isCorrect, explanation: problem.explanation });
      return;
    }
    setPending(true);
    const judged = onAnswer ? await onAnswer(answer) : null;
    setPending(false);
    if (!judged) {
      setSelected(null);
      setMessage(RETRY_MESSAGE);
      return;
    }
    if (judged.correct) {
      soundManager.playCorrect();
      void playPraiseVoice();
    } else {
      soundManager.playWrong();
      void playEncourageVoice();
    }
    setResult(judged);
  }

  return (
    <section className={styles.problemCard}>
      <div className={styles.quizTop}>
        <strong>れんしゅう {index + 1} / {total}</strong>
        <div className={styles.dots} aria-label={`${score}もん せいかい`}>
          {Array.from({ length: total }, (_, dotIndex) => (
            <i
              className={dotIndex < index ? styles.dotDone : dotIndex === index ? styles.dotCurrent : styles.dot}
              key={dotIndex}
            />
          ))}
        </div>
      </div>
      <p className={styles.problemText}><RubyAuto text={problem.question} readingMode={readingMode} excludeBrackets /></p>
      {problem.choices ? (
        <div className={styles.choiceGrid}>
          {problem.choices.map((choice) => (
            <button
              className={`${styles.choice} ${selected === choice ? styles.choiceSelected : ""}`}
              disabled={selected !== null || pending}
              key={choice}
              type="button"
              onClick={() => void submit(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.answerRow}>
          <input
            aria-label="こたえ"
            className={styles.answerInput}
            disabled={selected !== null || pending}
            placeholder="こたえを かこう"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <button
            className={styles.primaryButton}
            disabled={!typed.trim() || selected !== null || pending}
            type="button"
            onClick={() => void submit(typed.trim())}
          >
            こたえる
          </button>
        </div>
      )}
      {message ? (
        <>
          <p className={styles.feedbackWrong}>{message}</p>
          {lastAttempt !== null ? (
            <button className={styles.secondaryButton} type="button" onClick={() => void submit(lastAttempt)}>
              {RETRY_BUTTON}
            </button>
          ) : null}
        </>
      ) : null}
      {result && selected !== null ? (
        <>
          <p className={result.correct ? styles.feedback : styles.feedbackWrong}>
            {result.correct
              ? "せいかい！ いいちょうし！"
              : <>だいじょうぶ。<RubyAuto text={result.explanation ?? ENCOURAGE} readingMode={readingMode} /></>}
          </p>
          <button className={styles.primaryButton} type="button" onClick={() => onComplete(result.correct, selected)}>
            {index + 1 === total ? "けっかを みる" : "つぎの もんだい"}
          </button>
        </>
      ) : null}
    </section>
  );
}
