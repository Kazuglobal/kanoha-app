"use client";

import { useEffect, useRef, useState } from "react";
import { completeLearningSession } from "@/lib/sessions/complete";
import {
  clearProgress,
  readProgress,
  writeProgress,
  type LearningProgress,
  type StoredSimilarProblem,
} from "@/lib/sessions/progress";
import { visualTemplateFor, visualTemplateUrl } from "@/lib/curriculum/visuals";
import { applyServerReward, recordCorrectAnswer } from "@/lib/rewards/rewardStore";
import { soundManager } from "@/lib/audio/soundSystem";
import {
  playPraiseVoice,
  playEncourageVoice,
  preloadCoachVoices,
} from "@/lib/audio/coachSpeech";
import { SUBJECT_CONFIG, resolveSubject } from "@/lib/curriculum/subjects";
import {
  DEMO_PROBLEM_ID,
  DEMO_QUESTION,
  DEMO_UNIT,
  DEMO_VISUAL_URL,
  FLOW_TEXT,
} from "./childStrings";
import {
  checkDemoAnswer,
  elapsedSeconds,
  fetchDailyLimit,
  fetchHintText,
  fetchSimilarProblems,
  postAttempt,
  postJson,
  sendSessionKeepalive,
  startLearningSession,
  type DailyLimitInfo,
} from "./learningApi";
import type { SimilarAnswerResult, SimilarProblem } from "./SimilarProblemCard";

/** サーバーから渡される問題情報。答えとヒントは含まない(A2)。デモ時は正解検証用フォールバックを受け取れる。 */
export interface PersistedProblem {
  childId: string;
  problemId: string;
  question: string;
  unit: string;
  subject?: string;
  /** 選択式の問題の選択肢(英語など)。あればタップで答える。 */
  choices?: readonly string[];
  /** 英語の聞き取り用に en-US で読み上げる文 */
  listenText?: string;
  /** ステージマップの「つぎの もんだい」(問題バンクの id) */
  nextProblemId?: string | null;
  /** デモ専用: れんしゅう 5もん(答えは持たず、checkId でサーバーが判定する) */
  demoPractice?: readonly SimilarProblem[];
}

export interface PersistedSimilarProblem extends SimilarProblem {
  id: string;
}

export interface LearningPreferences {
  enableAudio: boolean;
  enableVoiceAnswer: boolean;
  readingMode: "kanji_with_ruby" | "hiragana";
}

const HINT_KEYS = ["hint1", "hint2", "solution", "answer"] as const;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

type FlowSimilarProblem = SimilarProblem | PersistedSimilarProblem;

/** 実データの類題(id つき)だけを sessionStorage 用の形にする。デモは保存しない。 */
const toStoredSimilar = (
  problems: readonly FlowSimilarProblem[],
): StoredSimilarProblem[] | null => {
  const stored = problems
    .filter((problem): problem is PersistedSimilarProblem => "id" in problem)
    .map((problem) => ({
      id: problem.id,
      question: problem.question,
      choices: problem.choices ? [...problem.choices] : null,
      ...(problem.listenText ? { listenText: problem.listenText } : {}),
    }));
  return stored.length > 0 && stored.length === problems.length ? stored : null;
};

/**
 * 学習フローの状態と操作(W6)。
 * - セッション開始は StrictMode の二重実行を ref で防ぎ、保存済みの途中経過があれば再利用する。
 * - 失敗した通信は「もういちど ためす」で再試行できる(retryAction)。
 * - タブが隠れる/閉じるときは keepalive PATCH で利用時間を記録する。
 */
export function useLearningFlow(persisted?: PersistedProblem) {
  const subject = resolveSubject(persisted?.subject, persisted?.unit);
  const defaultSimilar: readonly SimilarProblem[] = persisted?.demoPractice ?? [];
  const isDemo =
    !persisted || !UUID_PATTERN.test(persisted.childId) || !UUID_PATTERN.test(persisted.problemId);
  // デモはテンプレ図解だけ(AI生成なし)。テンプレが無い国語・英語には「えで おしえて」を出さない。
  const visualAvailable = !isDemo || !persisted || visualTemplateFor(persisted.unit, persisted.subject) !== null;

  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);
  const [revealedHints, setRevealedHints] = useState<readonly string[]>([]);
  const [practiceIndex, setPracticeIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(isDemo ? "demo-session" : null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [similarProblems, setSimilarProblems] = useState<readonly FlowSimilarProblem[]>(defaultSimilar);
  const [pending, setPending] = useState(Boolean(persisted) && !isDemo);
  const [simplifying, setSimplifying] = useState(false);
  const [visualPending, setVisualPending] = useState(false);
  const [visualUrl, setVisualUrl] = useState<string>();
  const [saveMessage, setSaveMessage] = useState("");
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [dailyLimit, setDailyLimit] = useState<DailyLimitInfo | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const originalSavedRef = useRef(false);

  const nextProblemHref = persisted?.nextProblemId
    ? `/child/problem/${persisted.nextProblemId}${persisted.childId ? `?childId=${persisted.childId}` : ""}`
    : null;

  const finished = practiceIndex !== null && practiceIndex >= similarProblems.length;
  const question = persisted?.question ?? DEMO_QUESTION;
  const unit = persisted?.unit ?? DEMO_UNIT;
  const nextParam = persisted?.nextProblemId ? `&nextProblemId=${persisted.nextProblemId}` : "";
  const resultHref = persisted
    ? `/child/result?score=${score}&unit=${encodeURIComponent(unit)}&problemId=${persisted.problemId}&childId=${persisted.childId}${nextParam}`
    : `/child/result?score=${score}&unit=${encodeURIComponent(unit)}${nextParam}`;

  async function startNewSession(target: PersistedProblem) {
    if (isDemo) {
      setSessionId("demo-session");
      setPending(false);
      return;
    }
    setPending(true);
    setSaveMessage("");
    setRetryAction(null);
    const result = await startLearningSession(target.childId);
    if (!result) {
      setSaveMessage(FLOW_TEXT.sessionStartFailed);
      setRetryAction(() => () => void startNewSession(target));
    } else if (result.limitReached) {
      setDailyLimit(result);
    } else if (result.id) {
      setSessionId(result.id);
    }
    setPending(false);
  }

  async function restoreHints(target: PersistedProblem, stored: LearningProgress) {
    const texts: string[] = [];
    for (let level = 1; level <= stored.revealedCount; level += 1) {
      const text = await fetchHintText(target.problemId, {
        childId: target.childId,
        sessionId: stored.sessionId,
        level,
      });
      if (text === null) break;
      texts.push(text);
    }
    setRevealedHints(texts);
  }

  /** 同じタブで開き直したときは、開いていたセッションを再利用して途中から続ける。 */
  async function restoreProgress(target: PersistedProblem, stored: LearningProgress) {
    setSessionId(stored.sessionId);
    setScore(stored.score);
    if (stored.similar && stored.practiceIndex !== null) {
      setSimilarProblems(stored.similar.map((problem) => ({ ...problem })));
      setPracticeIndex(Math.min(stored.practiceIndex, stored.similar.length));
    } else if (stored.revealedCount > 0) {
      await restoreHints(target, stored);
    }
    setPending(false);
  }

  useEffect(() => {
    if (!persisted || startedRef.current) return;
    startedRef.current = true;
    const stored = readProgress(persisted.problemId);
    if (stored) void restoreProgress(persisted, stored);
    else void startNewSession(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  // 途中経過の保存。完了・上限到達後は書かない(finish 側が clear する)。
  useEffect(() => {
    if (!persisted || !sessionId || finishedRef.current || dailyLimit) return;
    writeProgress({
      sessionId,
      problemId: persisted.problemId,
      practiceIndex,
      score,
      revealedCount: Math.min(revealedHints.length, 4),
      similar: toStoredSimilar(similarProblems),
    });
  }, [persisted, sessionId, practiceIndex, score, revealedHints, similarProblems, dailyLimit]);

  // タブが隠れる・閉じるとき、放置セッションにも利用時間を記録する(keepalive)。
  useEffect(() => {
    if (!persisted || !sessionId) return;
    const close = () => {
      if (!finishedRef.current) sendSessionKeepalive(sessionId, persisted.childId, startedAt);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") close();
    };
    window.addEventListener("pagehide", close);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", close);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [persisted, sessionId, startedAt]);

  // アプリ内リンクで画面を離れたとき(pagehide も hidden も起きない)にもセッションを閉じる。
  // 開いたままだと「最後の操作 + 猶予10分」が計上され、数問で上限に達してしまう。
  const openSessionRef = useRef<{ sessionId: string; childId: string; startedAt: number } | null>(null);
  useEffect(() => {
    openSessionRef.current = persisted && sessionId && !isDemo
      ? { sessionId, childId: persisted.childId, startedAt }
      : null;
  }, [persisted, sessionId, startedAt, isDemo]);
  useEffect(() => () => {
    const open = openSessionRef.current;
    if (open && !finishedRef.current) sendSessionKeepalive(open.sessionId, open.childId, open.startedAt);
  }, []);

  // 5問終了: セッション終了 → 復習予定 → Slack を直列で送り、途中経過を消す。
  useEffect(() => {
    if (!finished || !persisted || !sessionId || finishedRef.current) return;
    finishedRef.current = true;
    clearProgress(persisted.problemId);
    void completeLearningSession({
      childId: persisted.childId,
      durationSeconds: elapsedSeconds(startedAt),
      problemId: persisted.problemId,
      sessionId,
    });
  }, [finished, persisted, sessionId, startedAt]);

  /** ヒントを 1 段だけサーバーから取る。level は開いた数 + 1(サーバーも同じ規則で検証する)。 */
  async function requestNextHint(): Promise<boolean> {
    if (persisted && !sessionId) {
      setSaveMessage(FLOW_TEXT.waitForReady);
      return false;
    }
    const level = revealedHints.length + 1;
    const body = persisted ? { childId: persisted.childId, sessionId, level } : { level };
    const text = await fetchHintText(persisted?.problemId ?? DEMO_PROBLEM_ID, body);
    if (text === null) {
      setSaveMessage(FLOW_TEXT.hintLoadFailed);
      setRetryAction(() => () => void requestNextHint());
      return false;
    }
    setSaveMessage("");
    setRetryAction(null);
    setRevealedHints((current) => [...current, text]);
    soundManager.playHint();
    return true;
  }

  useEffect(() => {
    preloadCoachVoices();
  }, []);

  /** 元問題の正誤はサーバー(/api/attempts)が判定する。デモだけはクライアントで照合する。 */
  async function checkOriginalAnswer(overrideAnswer?: string) {
    const candidateAnswer = (overrideAnswer ?? answer).trim();
    if (!candidateAnswer) return;
    if (overrideAnswer && overrideAnswer !== answer) {
      setAnswer(overrideAnswer);
    }
    if (!persisted || isDemo) {
      const judged = await checkDemoAnswer(persisted?.problemId ?? DEMO_PROBLEM_ID, candidateAnswer);
      if (!judged) {
        setSaveMessage(FLOW_TEXT.answerSendFailed);
        setRetryAction(() => () => void checkOriginalAnswer(candidateAnswer));
        return;
      }
      setSaveMessage("");
      setRetryAction(null);
      const isCorrect = judged.correct;
      setChecked({ correct: isCorrect });
      if (isCorrect) {
        soundManager.playCorrect();
        recordCorrectAnswer();
        void playPraiseVoice();
      } else {
        soundManager.playWrong();
        void playEncourageVoice();
      }
      return;
    }
    // 送信中の二重送信と、正解後の再送信だけを止める(まちがえたら何度でも挑戦できる)。
    if (!sessionId || originalSavedRef.current || checked?.correct) return;
    originalSavedRef.current = true;
    const result = await postAttempt({
      childId: persisted.childId,
      sessionId,
      problemId: persisted.problemId,
      childAnswer: candidateAnswer,
      answerType: overrideAnswer ? "handwriting" : "text",
    });
    if (!result) {
      originalSavedRef.current = false;
      setSaveMessage(FLOW_TEXT.answerSendFailed);
      setRetryAction(() => () => void checkOriginalAnswer(candidateAnswer));
      return;
    }
    originalSavedRef.current = false;
    setSaveMessage("");
    setRetryAction(null);
    setChecked({ correct: result.correct });
    if (result.correct) {
      soundManager.playCorrect();
      applyServerReward(result.reward);
      void playPraiseVoice();
    } else {
      soundManager.playWrong();
      void playEncourageVoice();
    }
  }

  async function startPractice() {
    if (!persisted || isDemo) {
      setPracticeIndex(0);
      return;
    }
    setPending(true);
    setSaveMessage("");
    setRetryAction(null);
    const problems = await fetchSimilarProblems(persisted.childId, persisted.problemId);
    if (!problems) {
      setSaveMessage(FLOW_TEXT.practicePrepFailed);
      setRetryAction(() => () => void startPractice());
      setPending(false);
      return;
    }
    setSimilarProblems(problems.map((problem) => ({ ...problem })));
    setPracticeIndex(0);
    setPending(false);
  }

  /** 「もっとかんたんに」: サーバーは開いた段階までしか返さないので、開いた分だけ置き換える。 */
  async function simplifyHints() {
    if (simplifying) return;
    setSimplifying(true);
    setSaveMessage("");

    const targetChildId = persisted?.childId || "demo";
    const targetProblemId = persisted?.problemId || DEMO_PROBLEM_ID;
    const effectiveSessionId = sessionId || "demo-session";

    const response = await postJson("/api/ai/generate-hints", {
      childId: targetChildId,
      problemId: targetProblemId,
      sessionId: effectiveSessionId,
      explanationLevel: "very_easy",
    }).catch(() => null);

    const body = await response?.json().catch(() => null);

    const { hint1: fallbackHint1, hint2: fallbackHint2 } = SUBJECT_CONFIG[subject].fallbackHints;
    const easyHint1 = (typeof body?.data?.hint1 === "string" && body.data.hint1) || fallbackHint1;
    const easyHint2 = (typeof body?.data?.hint2 === "string" && body.data.hint2) || fallbackHint2;

    setRevealedHints((current) => {
      if (current.length === 0) {
        return [easyHint1];
      }
      return current.map((hint, index) => {
        const replaced = body?.data?.[HINT_KEYS[index]];
        if (typeof replaced === "string" && replaced) return replaced;
        if (index === 0) return easyHint1;
        if (index === 1) return easyHint2;
        return hint;
      });
    });

    setSaveMessage(FLOW_TEXT.simplified);
    setSimplifying(false);
  }

  async function showVisualHint() {
    if (!persisted) {
      setVisualUrl(DEMO_VISUAL_URL);
      setSaveMessage("");
      return;
    }
    if (visualPending) return;
    setVisualPending(true);
    setSaveMessage("");
    const response = await postJson("/api/ai/generate-image", {
      childId: persisted.childId,
      problemId: persisted.problemId,
      requestedByChild: true,
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    const receivedUrl = body?.data?.url ?? body?.data?.dataUrl;

    if (response?.ok && body?.success && typeof receivedUrl === "string") {
      setVisualUrl(receivedUrl);
      setVisualPending(false);
      return;
    }

    // サーバーが失敗した場合(403設定OFFやネットワーク等)でも、小2単元の静的SVGテンプレートをフォールバック表示
    const fallback = visualTemplateFor(persisted.unit, persisted.subject);
    if (fallback) {
      setVisualUrl(visualTemplateUrl(fallback));
      setSaveMessage("");
    } else {
      setSaveMessage(FLOW_TEXT.visualUnavailable);
    }
    setVisualPending(false);
  }

  /** 類題の回答を保存し、サーバーの判定(と不正解時の解説)を返す。 */
  async function answerSimilar(selectedAnswer: string): Promise<SimilarAnswerResult | null> {
    const current = practiceIndex === null ? null : similarProblems[practiceIndex];
    if (!persisted || !sessionId || !current || !("id" in current)) return null;
    return postAttempt({
      childId: persisted.childId,
      sessionId,
      similarProblemId: current.id,
      childAnswer: selectedAnswer,
      answerType: current.choices ? "tap" : "text",
    });
  }

  /** 上限到達: 部分セッションでも復習予定と親レポートまでつなげてから止める(W6)。 */
  async function stopForToday(limit: DailyLimitInfo) {
    if (!persisted || !sessionId) return;
    finishedRef.current = true;
    clearProgress(persisted.problemId);
    await completeLearningSession({
      childId: persisted.childId,
      durationSeconds: elapsedSeconds(startedAt),
      problemId: persisted.problemId,
      sessionId,
    });
    setDailyLimit(limit);
  }

  async function completeSimilar(correct: boolean) {
    if (correct) {
      recordCorrectAnswer();
    }
    setScore((currentScore) => currentScore + (correct ? 1 : 0));
    const nextIndex = (practiceIndex ?? 0) + 1;
    // 利用時間の上限は類題の区切りでだけ確かめる(問題の途中では止めない)。
    if (persisted && sessionId && nextIndex < similarProblems.length) {
      const limit = await fetchDailyLimit(persisted.childId);
      if (limit?.limitReached) {
        await stopForToday(limit);
        return;
      }
    }
    setPracticeIndex(nextIndex);
  }

  /** 「もういちど やる」: 同じ問題を新しいセッションで最初からやり直す(doc §6.1)。 */
  async function restartFlow() {
    setChecked(null);
    setAnswer("");
    setRevealedHints([]);
    setPracticeIndex(null);
    setScore(0);
    setVisualUrl(undefined);
    setSaveMessage("");
    setRetryAction(null);
    setStartedAt(Date.now());
    setSimilarProblems(defaultSimilar);
    finishedRef.current = false;
    originalSavedRef.current = false;
    if (persisted) {
      clearProgress(persisted.problemId);
      setSessionId(null);
      await startNewSession(persisted);
    }
  }

  return {
    subject, answer, setAnswer, checked, revealedHints, practiceIndex, score, sessionId,
    similarProblems, pending, simplifying, visualPending, visualUrl, visualAvailable,
    saveMessage, retryAction, dailyLimit, finished, question, unit, resultHref,
    nextProblemHref,
    requestNextHint, checkOriginalAnswer, startPractice, simplifyHints,
    showVisualHint, answerSimilar, completeSimilar, restartFlow,
  };
}
