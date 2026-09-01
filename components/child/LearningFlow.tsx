"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { completeLearningSession } from "@/lib/sessions/complete";
import { answersMatch } from "@/lib/utils/answers";
import { CharacterCoach } from "./CharacterCoach";
import { HandwritingPad } from "./HandwritingPad";
import { HintStepper } from "./HintStepper";
import { RubyAuto } from "./RubyText";
import { SimilarProblemCard, type SimilarAnswerResult, type SimilarProblem } from "./SimilarProblemCard";
import { VoiceAnswer } from "./VoiceAnswer";
import { VoiceButton } from "./VoiceButton";

/** サーバーから渡される問題情報。答えとヒントは含まない(A2)。 */
interface PersistedProblem {
  childId: string;
  problemId: string;
  question: string;
  unit: string;
}

interface PersistedSimilarProblem extends SimilarProblem {
  id: string;
}

interface LearningPreferences {
  enableAudio: boolean;
  enableVoiceAnswer: boolean;
  readingMode: "kanji_with_ruby" | "hiragana";
}

/** Supabase 未設定時のデモ問題。ヒントは /api/problems/volume-1/hint(lib/ai/mock.ts)が返す。 */
const DEMO_PROBLEM_ID = "volume-1";
const DEMO_QUESTION = "1L は なんmL ですか？";
const DEMO_UNIT = "かさ";
const HINT_KEYS = ["hint1", "hint2", "solution", "answer"] as const;

const demoSimilarProblems: readonly SimilarProblem[] = [
  { question: "2L は なんmL？", choices: ["200mL", "2000mL", "20mL", "1200mL"], answer: "2000mL", explanation: "1Lは1000mL。2こ分をかんがえよう。" },
  { question: "3000mL は なんL？", choices: ["3L", "30L", "300L", "1L"], answer: "3L", explanation: "1000mLがいくつあるか数えよう。" },
  { question: "1L と 500mL で ぜんぶで？", choices: ["1500mL", "600mL", "1050mL", "500mL"], answer: "1500mL", explanation: "1Lを1000mLになおしてたそう。" },
  { question: "4L は なんmL？", choices: ["400mL", "40mL", "4000mL", "1400mL"], answer: "4000mL", explanation: "1000mLが4こ分だよ。" },
  { question: "5000mL は なんL？", choices: ["50L", "5L", "500L", "2L"], answer: "5L", explanation: "1000mLずつに分けよう。" },
];

const postJson = (url: string, body: Record<string, unknown>) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function LearningFlow({
  persisted,
  preferences = { enableAudio: true, enableVoiceAnswer: true, readingMode: "kanji_with_ruby" },
}: {
  persisted?: PersistedProblem;
  preferences?: LearningPreferences;
}) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);
  const [revealedHints, setRevealedHints] = useState<readonly string[]>([]);
  const [practiceIndex, setPracticeIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [similarProblems, setSimilarProblems] = useState<readonly (SimilarProblem | PersistedSimilarProblem)[]>(demoSimilarProblems);
  const [pending, setPending] = useState(Boolean(persisted));
  const [simplifying, setSimplifying] = useState(false);
  const [visualPending, setVisualPending] = useState(false);
  const [visualUrl, setVisualUrl] = useState<string>();
  const [saveMessage, setSaveMessage] = useState("");
  const [dailyLimit, setDailyLimit] = useState<{ limitMinutes: number; usedMinutes: number } | null>(null);
  const finishedRef = useRef(false);
  const originalSavedRef = useRef(false);
  const finished = practiceIndex === similarProblems.length;
  const question = persisted?.question ?? DEMO_QUESTION;
  const unit = persisted?.unit ?? DEMO_UNIT;

  useEffect(() => {
    if (!persisted) return;
    void postJson("/api/sessions", { childId: persisted.childId }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (response.ok && body?.success && body.data.limitReached) {
        setDailyLimit({ limitMinutes: body.data.limitMinutes, usedMinutes: body.data.usedMinutes });
      } else if (response.ok && body?.success) setSessionId(body.data.id);
      else setSaveMessage("学習記録を開始できませんでした。");
      setPending(false);
    });
  }, [persisted]);

  useEffect(() => {
    if (!finished || !persisted || !sessionId || finishedRef.current) return;
    finishedRef.current = true;
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    void completeLearningSession({
      childId: persisted.childId,
      durationSeconds,
      problemId: persisted.problemId,
      sessionId,
    });
  }, [finished, persisted, sessionId, startedAt]);

  /** ヒントを 1 段だけサーバーから取る。level は開いた数 + 1(サーバーも同じ規則で検証する)。 */
  async function requestNextHint(): Promise<boolean> {
    const level = revealedHints.length + 1;
    if (persisted && !sessionId) {
      setSaveMessage("じゅんびが おわるまで まってね。");
      return false;
    }
    const body = persisted ? { childId: persisted.childId, sessionId, level } : { level };
    const response = await postJson(`/api/problems/${persisted?.problemId ?? DEMO_PROBLEM_ID}/hint`, body).catch(() => null);
    const json = await response?.json().catch(() => null);
    if (!response?.ok || !json?.success || typeof json.data?.text !== "string") {
      setSaveMessage("ヒントを よみこめなかったよ。もういちど おしてね。");
      return false;
    }
    setSaveMessage("");
    setRevealedHints((current) => [...current, json.data.text]);
    return true;
  }

  /** 元問題の正誤はサーバー(/api/attempts)が判定する。デモだけはクライアントで照合する。 */
  async function checkOriginalAnswer() {
    if (!persisted) {
      setChecked({ correct: answersMatch(answer, "1000mL") });
      return;
    }
    if (!sessionId || originalSavedRef.current) return;
    originalSavedRef.current = true;
    const response = await postJson("/api/attempts", {
      childId: persisted.childId,
      sessionId,
      problemId: persisted.problemId,
      childAnswer: answer,
      answerType: "text",
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) {
      originalSavedRef.current = false;
      setSaveMessage("こたえを おくれなかったよ。もういちど おしてね。");
      return;
    }
    setChecked({ correct: Boolean(body.data.is_correct) });
  }

  async function startPractice() {
    if (!persisted) {
      setPracticeIndex(0);
      return;
    }
    setPending(true);
    const response = await postJson("/api/ai/generate-similar-problems", {
      childId: persisted.childId,
      problemId: persisted.problemId,
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) {
      setSaveMessage("れんしゅう問題を準備できませんでした。");
      setPending(false);
      return;
    }
    setSimilarProblems(body.data.map((item: { id: string; problem_text: string; choices?: string[] | null }) => ({
      id: item.id,
      question: item.problem_text,
      choices: Array.isArray(item.choices) ? item.choices : null,
    })));
    setPracticeIndex(0);
    setPending(false);
  }

  /** 「もっとかんたんに」: サーバーは開いた段階までしか返さないので、開いた分だけ置き換える。 */
  async function simplifyHints() {
    if (!persisted || !sessionId || simplifying) return;
    setSimplifying(true);
    setSaveMessage("");
    const response = await postJson("/api/ai/generate-hints", {
      childId: persisted.childId,
      problemId: persisted.problemId,
      sessionId,
      explanationLevel: "very_easy",
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) {
      setSaveMessage("ヒントをかんたんにできませんでした。");
      setSimplifying(false);
      return;
    }
    setRevealedHints((current) => current.map((hint, index) => {
      const replaced = body.data[HINT_KEYS[index]];
      return typeof replaced === "string" ? replaced : hint;
    }));
    setSaveMessage("ヒントを もっと かんたんにしたよ。");
    setSimplifying(false);
  }

  async function showVisualHint() {
    if (!persisted || visualPending) return;
    setVisualPending(true);
    setSaveMessage("");
    const response = await postJson("/api/ai/generate-image", {
      childId: persisted.childId,
      problemId: persisted.problemId,
      requestedByChild: true,
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) {
      setSaveMessage("このもんだいの えは、まだ じゅんびできません。");
      setVisualPending(false);
      return;
    }
    setVisualUrl(body.data.url);
    setVisualPending(false);
  }

  /** 類題の回答を保存し、サーバーの判定(と不正解時の解説)を返す。 */
  async function answerSimilar(selectedAnswer: string): Promise<SimilarAnswerResult | null> {
    const current = practiceIndex === null ? null : similarProblems[practiceIndex];
    if (!persisted || !sessionId || !current || !("id" in current)) return null;
    const response = await postJson("/api/attempts", {
      childId: persisted.childId,
      sessionId,
      similarProblemId: current.id,
      childAnswer: selectedAnswer,
      answerType: current.choices ? "tap" : "text",
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) return null;
    return { correct: Boolean(body.data.is_correct), explanation: body.data.explanation ?? null };
  }

  async function completeSimilar(correct: boolean) {
    setScore((currentScore) => currentScore + (correct ? 1 : 0));
    const nextIndex = (practiceIndex ?? 0) + 1;
    // 利用時間の上限は類題の区切りでだけ確かめる(問題の途中では止めない)。
    if (persisted && sessionId && nextIndex < similarProblems.length) {
      const limit = await fetchDailyLimit(persisted.childId);
      if (limit?.limitReached) {
        await closeSession(sessionId, persisted.childId, startedAt);
        setDailyLimit(limit);
        return;
      }
    }
    setPracticeIndex(nextIndex);
  }

  if (dailyLimit) {
    return (
      <section className={`${styles.card} ${styles.resultHero}`}>
        <CharacterCoach message="きょうも よくがんばったね。つづきは またあした！" mood="celebrate" />
        <h1 className={styles.pageTitle}>きょうは ここまで！</h1>
        <p className={styles.lead}>きょうは {dailyLimit.usedMinutes}分 がんばりました。</p>
        <Link className={styles.primaryButton} href="/child/home">ホームへ もどる</Link>
      </section>
    );
  }

  if (finished) {
    return (
      <section className={`${styles.card} ${styles.resultHero}`}>
        <CharacterCoach message={score >= 4 ? "できた！ さいこうだよ！" : "さいごまで よくがんばったね！"} mood="celebrate" />
        <h1 className={styles.pageTitle}>{score >= 4 ? "できた！" : "もういちど やってみよう"}</h1>
        <p className={styles.score}>{score}/5</p>
        <p className={styles.lead}>{unit}を、じぶんで かんがえられたね。</p>
        <Link className={styles.primaryButton} href={`/child/result?score=${score}&unit=${encodeURIComponent(unit)}`}>
          きょうの けっかへ
        </Link>
      </section>
    );
  }

  if (practiceIndex !== null) {
    return (
      <SimilarProblemCard
        index={practiceIndex}
        key={practiceIndex}
        problem={similarProblems[practiceIndex]}
        score={score}
        total={similarProblems.length}
        onAnswer={persisted ? answerSimilar : undefined}
        onComplete={(correct) => void completeSimilar(correct)}
      />
    );
  }

  return (
    <>
      <section className={styles.problemCard}>
        <div className={styles.quizTop}>
          <span className={styles.problemNumber}>きょうの おすすめ 1</span>
          {preferences.enableAudio ? <VoiceButton text={question} /> : null}
        </div>
        <h1 className={styles.problemText}><RubyAuto text={question} readingMode={preferences.readingMode} /></h1>
        <div className={styles.answerRow}>
          <input
            aria-label="こたえ"
            className={styles.answerInput}
            inputMode="numeric"
            placeholder="すうじ"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
          <button className={styles.primaryButton} disabled={!answer || pending} type="button" onClick={() => void checkOriginalAnswer()}>
            こたえる
          </button>
          {preferences.enableVoiceAnswer ? <VoiceAnswer onAnswer={setAnswer} /> : null}
          {persisted ? (
            <HandwritingPad childId={persisted.childId} onAnswer={setAnswer} problemId={persisted.problemId} />
          ) : null}
        </div>
        {checked ? (
          <div className={checked.correct ? styles.feedback : styles.feedbackWrong}>
            {checked.correct ? "せいかい！ よく できたね。" : "おしい！ ヒントをつかって、ゆっくりかんがえよう。"}
          </div>
        ) : null}
        <HintStepper
          revealed={revealedHints}
          onRequestNext={requestNextHint}
          readingMode={preferences.readingMode}
          onSimplify={persisted ? () => void simplifyHints() : undefined}
          simplifying={simplifying}
          onVisual={persisted ? () => void showVisualHint() : undefined}
          visualPending={visualPending}
          visualUrl={visualUrl}
        />
        <div className={styles.hintActions}>
          <button className={styles.secondaryButton} disabled={pending} type="button" onClick={() => void startPractice()}>
            {pending ? "じゅんび中..." : "れんしゅう 5もんへ"}
          </button>
        </div>
        {saveMessage ? <p className={styles.feedbackWrong}>{saveMessage}</p> : null}
      </section>
      <CharacterCoach message="わからないときは、ヒントをひとつずつ見よう。" mood="think" />
    </>
  );
}

async function fetchDailyLimit(childId: string) {
  const response = await fetch(`/api/sessions?childId=${encodeURIComponent(childId)}`).catch(() => null);
  const body = await response?.json().catch(() => null);
  if (!response?.ok || !body?.success) return null;
  return body.data as { limitMinutes: number; usedMinutes: number; limitReached: boolean };
}

async function closeSession(sessionId: string, childId: string, startedAt: number) {
  const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  await fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ childId, durationSeconds }),
  }).catch(() => null);
}
