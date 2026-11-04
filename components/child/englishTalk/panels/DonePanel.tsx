import { Headphones, RotateCcw, Star } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { TaughtPhrase } from "../useEnglishTalk";
import styles from "../englishTalk.module.css";

interface DonePanelProps {
  stars: 1 | 2 | 3;
  score: { firstTry: number; total: number };
  /** おてほんを見たターンのフレーズ(見なおし用) */
  taught: readonly TaughtPhrase[];
  /** 音を切ってあるとき(親の設定)は聞くボタンを出さない */
  audioEnabled: boolean;
  onListen: (text: string) => void;
  onRestart: () => void;
  listHref: Route;
}

export function DonePanel({ stars, score, taught, audioEnabled, onListen, onRestart, listHref }: DonePanelProps) {
  return (
    <div className={styles.donePanel}>
      <p className={styles.doneTitle}>おはなし できたね！</p>
      <div className={styles.stars} aria-label={`ほし ${stars}こ`}>
        {Array.from({ length: 3 }, (_, index) => (
          <Star key={index} size={40} fill={index < stars ? "#ffc83d" : "none"} color="#f0a500" />
        ))}
      </div>
      <p className={styles.message}>
        さいしょで つたわった しつもん: {score.firstTry} / {score.total}
      </p>

      {taught.length > 0 && (
        <section className={styles.reviewBox} aria-label="きょう れんしゅうした ことば">
          <h3 className={styles.reviewTitle}>きょう れんしゅうした ことば</h3>
          <ul className={styles.reviewList}>
            {taught.map((phrase) => (
              <li key={phrase.turnId} className={styles.reviewItem}>
                <div className={styles.reviewText}>
                  <p className={styles.reviewEnglish} lang="en">
                    {phrase.modelAnswer}
                  </p>
                  <p className={styles.reviewJapanese}>{phrase.modelAnswerJa}</p>
                </div>
                {audioEnabled && (
                  <button
                    className={styles.listenButton}
                    type="button"
                    onClick={() => onListen(phrase.modelAnswer)}
                    aria-label={`${phrase.modelAnswer} を きく`}
                  >
                    <Headphones size={20} aria-hidden="true" /> きく
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.answerTools}>
        <button className={styles.saidButton} type="button" onClick={onRestart}>
          <RotateCcw size={20} aria-hidden="true" /> もういちど
        </button>
        <Link className={styles.nextButton} href={listHref}>
          ほかの シーンへ ▶
        </Link>
      </div>
    </div>
  );
}
