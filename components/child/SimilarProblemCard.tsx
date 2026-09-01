"use client";

import { useState } from "react";
import styles from "@/components/kanoha.module.css";

export type SimilarProblem = {
  question: string;
  choices: readonly string[];
  answer: string;
  explanation: string;
};

export function SimilarProblemCard({
  problem,
  index,
  total,
  score,
  onComplete,
}: {
  problem: SimilarProblem;
  index: number;
  total: number;
  score: number;
  onComplete: (correct: boolean, selectedAnswer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const isCorrect = selected === problem.answer;

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
      <p className={styles.problemText}>{problem.question}</p>
      <div className={styles.choiceGrid}>
        {problem.choices.map((choice) => (
          <button
            className={`${styles.choice} ${selected === choice ? styles.choiceSelected : ""}`}
            disabled={selected !== null}
            key={choice}
            type="button"
            onClick={() => setSelected(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
      {selected ? (
        <>
          <p className={isCorrect ? styles.feedback : styles.feedbackWrong}>
            {isCorrect ? "せいかい！ いいちょうし！" : `だいじょうぶ。${problem.explanation}`}
          </p>
          <button className={styles.primaryButton} type="button" onClick={() => onComplete(isCorrect, selected)}>
            {index + 1 === total ? "けっかを みる" : "つぎの もんだい"}
          </button>
        </>
      ) : null}
    </section>
  );
}
