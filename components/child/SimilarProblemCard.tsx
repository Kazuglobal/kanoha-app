"use client";

import { Volume2, RotateCcw } from "lucide-react";
import { useState } from "react";
import styles from "@/components/kanoha.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import { playPraiseVoice, playEncourageVoice } from "@/lib/audio/coachSpeech";
import { matchChoiceFromSpeech } from "@/lib/utils/answers";
import { checkDemoAnswer } from "./learningApi";
import { ListenButton, speakEnglish } from "./ListenButton";
import { RubyAuto } from "./RubyText";
import { VoiceAnswer } from "./VoiceAnswer";

export type SimilarProblem = {
  question: string;
  /** サーバーが作った 4 択。null のときは文字入力にフォールバックする。 */
  choices: readonly string[] | null;
  /** デモ専用: POST /api/demo/check の照合 id。実データでは渡さず、正誤は /api/attempts が返す。 */
  checkId?: string;
  /** 英語の聞き取り問題で読み上げる英語 */
  listenText?: string;
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
    if (/[a-zA-Z]/.test(answer)) {
      void speakEnglish(answer);
    }
    soundManager.playTap();
    setMessage("");
    setSelected(answer);
    setLastAttempt(answer);
    setPending(true);
    const judged = problem.checkId
      ? await checkDemoAnswer(problem.checkId, answer)
      : onAnswer
        ? await onAnswer(answer)
        : null;
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
      {problem.listenText ? <ListenButton text={problem.listenText} /> : null}
      {problem.choices ? (
        <div className={styles.choiceAnswersWrap}>
          {selected === null && (
            <div className={styles.choiceVoiceRow} style={{ marginBottom: "0.75rem" }}>
              <VoiceAnswer
                disabled={pending}
                lang={/[a-zA-Z]/.test(problem.choices[0] ?? "") ? "en-US" : "ja-JP"}
                onAnswer={(spoken) => {
                  const matched = matchChoiceFromSpeech(spoken, problem.choices ?? []);
                  if (matched) void submit(matched);
                  else void submit(spoken);
                }}
                onSubmitAnswer={(spoken) => {
                  const matched = matchChoiceFromSpeech(spoken, problem.choices ?? []);
                  if (matched) void submit(matched);
                  else void submit(spoken);
                }}
              />
            </div>
          )}
          <div className={styles.choiceGrid}>
            {problem.choices.map((choice) => {
              const isEnglish = /[a-zA-Z]/.test(choice);
              return (
                <button
                  className={`${styles.choice} ${selected === choice ? styles.choiceSelected : ""}`}
                  disabled={selected !== null || pending}
                  key={choice}
                  type="button"
                  onClick={() => void submit(choice)}
                >
                  <span>{choice}</span>
                  {isEnglish ? <Volume2 size={16} aria-hidden="true" className={styles.choiceSpeakerIcon} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.choiceAnswersWrap}>
          {selected === null && (
            <div className={styles.choiceVoiceRow} style={{ marginBottom: "0.75rem" }}>
              <VoiceAnswer
                disabled={pending}
                lang={/[a-zA-Z]/.test(problem.question) ? "en-US" : "ja-JP"}
                onAnswer={(spoken) => {
                  setTyped(spoken);
                }}
                onSubmitAnswer={(spoken) => {
                  setTyped(spoken);
                  void submit(spoken);
                }}
              />
            </div>
          )}
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
          <div className={result.correct ? styles.feedback : styles.feedbackWrong}>
            {result.correct ? (
              <span>🎉 せいかい！ いいちょうし！</span>
            ) : (
              <div>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>おしい！もういちど かんがえてみよう！</p>
                <p style={{ fontSize: "0.95rem", opacity: 0.95 }}>
                  💡 <RubyAuto text={result.explanation ?? ENCOURAGE} readingMode={readingMode} />
                </p>
              </div>
            )}
          </div>
          <div className={styles.stageClearButtons} style={{ marginTop: "1rem" }}>
            {!result.correct && (
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  setSelected(null);
                  setResult(null);
                  setTyped("");
                  soundManager.playTap();
                }}
              >
                <RotateCcw size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                もういちど ちょうせん！
              </button>
            )}
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => onComplete(result.correct, selected)}
            >
              {index + 1 === total ? "けっかを みる" : "つぎの もんだい"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
