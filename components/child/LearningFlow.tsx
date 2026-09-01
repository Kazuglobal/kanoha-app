"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { completeLearningSession } from "@/lib/sessions/complete";
import { CharacterCoach } from "./CharacterCoach";
import { HandwritingPad } from "./HandwritingPad";
import { HintStepper } from "./HintStepper";
import { RubyAuto } from "./RubyText";
import { SimilarProblemCard, type SimilarProblem } from "./SimilarProblemCard";
import { VoiceAnswer } from "./VoiceAnswer";
import { VoiceButton } from "./VoiceButton";

interface PersistedProblem {
  childId: string;
  problemId: string;
  question: string;
  correctAnswer: string;
  unit: string;
  hints: readonly [string, string, string, string];
}

interface PersistedSimilarProblem extends SimilarProblem {
  id: string;
}

interface LearningPreferences {
  enableAudio: boolean;
  enableVoiceAnswer: boolean;
  readingMode: "kanji_with_ruby" | "hiragana";
}

const demoSimilarProblems: readonly SimilarProblem[] = [
  { question: "2L は なんmL？", choices: ["200mL", "2000mL", "20mL", "1200mL"], answer: "2000mL", explanation: "1Lは1000mL。2こ分をかんがえよう。" },
  { question: "3000mL は なんL？", choices: ["3L", "30L", "300L", "1L"], answer: "3L", explanation: "1000mLがいくつあるか数えよう。" },
  { question: "1L と 500mL で ぜんぶで？", choices: ["1500mL", "600mL", "1050mL", "500mL"], answer: "1500mL", explanation: "1Lを1000mLになおしてたそう。" },
  { question: "4L は なんmL？", choices: ["400mL", "40mL", "4000mL", "1400mL"], answer: "4000mL", explanation: "1000mLが4こ分だよ。" },
  { question: "5000mL は なんL？", choices: ["50L", "5L", "500L", "2L"], answer: "5L", explanation: "1000mLずつに分けよう。" },
];

function makeChoices(answer: string, index: number) {
  const match = answer.match(/^(\d+)(.*)$/);
  if (!match) return [answer, "わからない", "もういちど", "ヒントをみる"];
  const value = Number(match[1]);
  const unit = match[2];
  const candidates = [
    answer,
    `${Math.max(1, value - 1000)}${unit}`,
    `${value + 1000}${unit}`,
    `${Math.max(1, Math.round(value / 10))}${unit}`,
  ];
  return [...new Set(candidates)].sort((a, b) => (a === answer ? index % 2 : b === answer ? 1 - index % 2 : a.localeCompare(b)));
}

export function LearningFlow({
  persisted,
  preferences = { enableAudio: true, enableVoiceAnswer: true, readingMode: "kanji_with_ruby" },
}: {
  persisted?: PersistedProblem;
  preferences?: LearningPreferences;
}) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
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
  const question = persisted?.question ?? "1L は なんmL ですか？";
  const correctAnswer = persisted?.correctAnswer ?? "1000mL";
  const [activeHints, setActiveHints] = useState<readonly [string, string, string, string]>(() => persisted?.hints ?? [
    "Lは、おおきな かさを あらわす たんいだよ。",
    "100mLの コップが 10こ分だよ。",
    "100mLを 10こ あつめると、1000mLになるよ。",
    "1000mL",
  ]);

  useEffect(() => {
    if (!persisted) return;
    void fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId: persisted.childId }),
    }).then(async (response) => {
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
      score,
      sessionId,
    });
  }, [finished, persisted, score, sessionId, startedAt]);

  async function checkOriginalAnswer() {
    setChecked(true);
    if (!persisted || !sessionId || originalSavedRef.current) return;
    originalSavedRef.current = true;
    await saveAttempt({
      childId: persisted.childId,
      sessionId,
      problemId: persisted.problemId,
      childAnswer: answer,
      answerType: "text",
      hintLevelUsed: hintLevel,
    });
  }

  async function startPractice() {
    if (!persisted) {
      setPracticeIndex(0);
      return;
    }
    setPending(true);
    const response = await fetch("/api/ai/generate-similar-problems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId: persisted.childId, problemId: persisted.problemId }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setSaveMessage("れんしゅう問題を準備できませんでした。");
      setPending(false);
      return;
    }
    setSimilarProblems(body.data.map((item: Record<string, string>, index: number) => ({
      id: item.id,
      question: item.problem_text,
      answer: item.answer,
      explanation: item.explanation,
      choices: makeChoices(item.answer, index),
    })));
    setPracticeIndex(0);
    setPending(false);
  }

  async function simplifyHints() {
    if (!persisted || simplifying) return;
    setSimplifying(true);
    setSaveMessage("");
    const response = await fetch("/api/ai/generate-hints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: persisted.childId,
        problemId: persisted.problemId,
        explanationLevel: "very_easy",
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setSaveMessage("ヒントをかんたんにできませんでした。");
      setSimplifying(false);
      return;
    }
    setActiveHints([body.data.hint1, body.data.hint2, body.data.solution, body.data.answer]);
    setSaveMessage("ヒントを もっと かんたんにしたよ。");
    setSimplifying(false);
  }

  async function showVisualHint() {
    if (!persisted || visualPending) return;
    setVisualPending(true);
    setSaveMessage("");
    const response = await fetch("/api/ai/generate-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: persisted.childId,
        problemId: persisted.problemId,
        requestedByChild: true,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setSaveMessage("このもんだいの えは、まだ じゅんびできません。");
      setVisualPending(false);
      return;
    }
    setVisualUrl(body.data.url);
    setVisualPending(false);
  }

  async function completeSimilar(correct: boolean, selectedAnswer: string) {
    const current = practiceIndex === null ? null : similarProblems[practiceIndex];
    if (persisted && sessionId && current && "id" in current) {
      await saveAttempt({
        childId: persisted.childId,
        sessionId,
        similarProblemId: current.id,
        childAnswer: selectedAnswer,
        answerType: "tap",
        hintLevelUsed: 0,
      });
    }
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
        <p className={styles.lead}>{persisted?.unit ?? "かさ"}を、じぶんで かんがえられたね。</p>
        <Link className={styles.primaryButton} href={`/child/result?score=${score}&unit=${encodeURIComponent(persisted?.unit ?? "かさ")}`}>
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
        onComplete={(correct, selectedAnswer) => void completeSimilar(correct, selectedAnswer)}
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
          <div className={answerMatches(answer, correctAnswer) ? styles.feedback : styles.feedbackWrong}>
            {answerMatches(answer, correctAnswer)
              ? `せいかい！ ${correctAnswer}だね。`
              : "おしい！ ヒントをつかって、ゆっくりかんがえよう。"}
          </div>
        ) : null}
        <HintStepper
          hints={activeHints}
          readingMode={preferences.readingMode}
          onReveal={setHintLevel}
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

function answerMatches(actual: string, expected: string) {
  const normalizedActual = actual.replace(/\s/g, "").toLowerCase();
  const normalizedExpected = expected.replace(/\s/g, "").toLowerCase();
  const actualDigits = actual.replace(/\D/g, "");
  const expectedDigits = expected.replace(/\D/g, "");
  return normalizedActual === normalizedExpected ||
    Boolean(actualDigits && expectedDigits && actualDigits === expectedDigits);
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

async function saveAttempt(input: Record<string, unknown>) {
  return fetch("/api/attempts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
