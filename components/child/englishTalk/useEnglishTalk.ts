"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerTalk,
  currentTurnId,
  nextTalk,
  repeatTalk,
  REPEAT_TARGET,
  startTalk,
  talkScore,
  type TalkState,
} from "@/lib/englishTalk/flow";
import {
  buildCorrectiveFeedbackEn,
  detectChosenFruit,
  isDontKnowAnswer,
  type ChosenFruit,
  type PublicTalkScene,
  type PublicTalkTurn,
} from "@/lib/englishTalk/judge";
import { recordEnglishTalkSceneClear } from "@/lib/englishTalk/progressStore";
import * as talkSpeech from "@/lib/audio/englishTalkSpeech";
import { soundManager } from "@/lib/audio/soundSystem";
import { recordCorrectAnswer } from "@/lib/rewards/rewardStore";
import type { TalkMood } from "./TalkCharacter";

export interface TalkTeach {
  feedbackEn: string;
  modelAnswer: string;
  modelAnswerJa: string;
}

type CheckMode = "choice" | "voice" | "repeat";

interface CheckResult {
  correct: boolean;
  isDontKnow?: boolean;
  feedback?: string;
  feedbackEn?: string;
  modelAnswer?: string;
  modelAnswerJa?: string;
}

const PRAISE = ["Great job!", "Good!", "Nice!", "Perfect!", "Wonderful!"] as const;

async function postCheck(body: Record<string, unknown>): Promise<CheckResult | null> {
  const response = await fetch("/api/english-talk/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = await response?.json().catch(() => null);
  return response?.ok && json?.success ? (json.data as CheckResult) : null;
}

function adaptTurnWithContext(
  rawTurn: PublicTalkTurn | undefined,
  chosenFruit: ChosenFruit | null,
): PublicTalkTurn | undefined {
  if (!rawTurn) return undefined;
  if (rawTurn.id === "shop-how-many" && chosenFruit && chosenFruit.singular !== "apple") {
    return {
      ...rawTurn,
      prompt: `How many ${chosenFruit.plural}?`,
      promptJa: `${chosenFruit.labelJa}は いくつ ほしいですか？`,
      visual: `${chosenFruit.emoji}${chosenFruit.emoji}${chosenFruit.emoji}`,
    };
  }
  return rawTurn;
}

/**
 * 英会話れんしゅうの状態と操作。
 * - 声(en-US)でキャラクターと対話する
 * - 「I don't know」「わからない」と言ったら日本語にして教える
 * - まちがえたらすぐ英語で正しいフィードバックを返す
 * - 初回正解でごほうびメーターを進め、シーン完了時に獲得スターを記録する
 */
export function useEnglishTalk(scene: PublicTalkScene, childId?: string) {
  const turnIds = useMemo(() => scene.turns.map(({ id }) => id), [scene]);
  const [state, setState] = useState<TalkState>(() => startTalk(turnIds));
  const [started, setStarted] = useState(false);
  const [teach, setTeach] = useState<TalkTeach | null>(null);
  const [showJapanese, setShowJapanese] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<TalkMood>("happy");
  const [checking, setChecking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [directVoiceMode, setDirectVoiceMode] = useState(true);
  const [chosenFruit, setChosenFruit] = useState<ChosenFruit | null>(null);

  // 遅れて届いた声のこたえ(古い描画のコールバック)でも、いまの状態で判断する
  const stateRef = useRef(state);
  const checkingRef = useRef(false);
  const directVoiceRef = useRef(true);
  const chosenFruitRef = useRef<ChosenFruit | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);
  stateRef.current = state;
  directVoiceRef.current = directVoiceMode;
  chosenFruitRef.current = chosenFruit;

  const activeTurnId = currentTurnId(state);
  const rawTurn: PublicTalkTurn | undefined = scene.turns.find(({ id }) => id === activeTurnId);
  const turn = useMemo(() => adaptTurnWithContext(rawTurn, chosenFruit), [rawTurn, chosenFruit]);
  const turnIndex = useMemo(() => {
    const idx = scene.turns.findIndex(({ id }) => id === activeTurnId);
    return idx >= 0 ? idx : 0;
  }, [activeTurnId, scene.turns]);

  const clearAutoNextTimer = useCallback(() => {
    if (autoNextTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearAutoNextTimer();
      talkSpeech.stopTalkSpeech();
    },
    [clearAutoNextTimer],
  );

  useEffect(() => {
    const onStart = () => setSpeaking(true);
    const onEnd = () => setSpeaking(false);
    window.addEventListener("kanoha-coach-speaking-start", onStart);
    window.addEventListener("kanoha-coach-speaking-end", onEnd);
    return () => {
      window.removeEventListener("kanoha-coach-speaking-start", onStart);
      window.removeEventListener("kanoha-coach-speaking-end", onEnd);
    };
  }, []);

  // シーン完了時に獲得した星（★1〜3）を記録する
  useEffect(() => {
    if (state.phase !== "done") return;
    const score = talkScore(state);
    const stars: 1 | 2 | 3 =
      score.firstTry === score.total ? 3 : score.firstTry * 2 >= score.total ? 2 : 1;
    recordEnglishTalkSceneClear(scene.id, stars, childId);
  }, [childId, scene.id, state]);

  const sayPrompt = useCallback((target?: PublicTalkTurn) => {
    if (target) void talkSpeech.speakTalkEnglish(target.prompt);
  }, []);

  const begin = useCallback(() => {
    clearAutoNextTimer();
    setStarted(true);
    setLastHeard(null);
    talkSpeech.preloadTalkSceneSpeech?.(scene.turns.map((t) => t.prompt));
    sayPrompt(turn);
  }, [clearAutoNextTimer, sayPrompt, scene.turns, turn]);

  const askInJapanese = useCallback(() => {
    if (!turn) return;
    setShowJapanese(true);
    setMood("think");
    setMessage("にほんごに したよ！ きいてから えいごで はなしてみよう");
    void talkSpeech.speakTalkJapanese(`${turn.promptJa} ${turn.answerHintJa}`);
  }, [turn]);

  const next = useCallback(() => {
    clearAutoNextTimer();
    setState((current) => {
      const following = nextTalk(current);
      const nextRaw = scene.turns.find(({ id }) => id === currentTurnId(following));
      const nextTurn = adaptTurnWithContext(nextRaw, chosenFruitRef.current);
      if (following.phase === "ask" && nextTurn) {
        sayPrompt(nextTurn);
      }
      return following;
    });
    setTeach(null);
    setShowJapanese(false);
    setLastHeard(null);
    setMood("happy");
    setMessage(null);
  }, [clearAutoNextTimer, sayPrompt, scene.turns]);

  const scheduleAutoNext = useCallback(
    (delayMs: number) => {
      clearAutoNextTimer();
      if (typeof window === "undefined") return;
      autoNextTimerRef.current = window.setTimeout(() => {
        autoNextTimerRef.current = null;
        if (directVoiceRef.current && stateRef.current.phase === "correct") {
          next();
        }
      }, delayMs);
    },
    [clearAutoNextTimer, next],
  );

  const answer = useCallback(
    async (text: string, mode: Exclude<CheckMode, "repeat"> = "voice") => {
      const currentId = currentTurnId(stateRef.current);
      if (!turn || turn.id !== currentId || checkingRef.current || stateRef.current.phase !== "ask") return;
      const trimmed = text.trim();
      if (!trimmed) return;

      setLastHeard(trimmed);

      // 「I don't know」「わからない」と言ったら日本語にして教える(不正解にはしない)
      if (isDontKnowAnswer(trimmed)) {
        askInJapanese();
        return;
      }

      checkingRef.current = true;
      setChecking(true);
      const result = await postCheck({ sceneId: scene.id, turnId: turn.id, answer: trimmed, mode, childId });
      checkingRef.current = false;
      setChecking(false);
      if (!result) {
        setMessage("うまく きこえなかったよ。もういちど おしえてね");
        return;
      }

      if (result.isDontKnow) {
        askInJapanese();
        return;
      }

      const wasFirstTry = !stateRef.current.isRetry && !stateRef.current.missed.includes(turn.id);
      setState((current) => answerTalk(current, result.correct));

      if (result.correct) {
        if (turn.id === "shop-want") {
          const detected = detectChosenFruit(trimmed);
          if (detected) {
            chosenFruitRef.current = detected;
            setChosenFruit(detected);
          }
        }
        if (wasFirstTry) {
          recordCorrectAnswer();
        }
        const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
        setMood("celebrate");
        setMessage(result.feedback ?? `${praise} ばっちり つたわったよ！`);
        soundManager.playCorrect();
        await talkSpeech.speakTalkEnglish(praise, "celebrate");

        // 直接対話モードのときは、褒め言葉のあと自動で次のターンへ
        if (directVoiceRef.current) {
          scheduleAutoNext(700);
        }
        return;
      }

      // まちがえたらすぐ英語で正しいフィードバックをしてくれる
      soundManager.playWrong();
      setMood("think");
      const modelAnswer = result.modelAnswer ?? "";
      const feedbackEn = buildCorrectiveFeedbackEn(modelAnswer, result.feedbackEn);
      setTeach({
        feedbackEn,
        modelAnswer,
        modelAnswerJa: result.modelAnswerJa ?? "",
      });
      setMessage(feedbackEn);
      void talkSpeech.speakTalkEnglish(feedbackEn, "think");
    },
    [askInJapanese, childId, scene.id, scheduleAutoNext, turn],
  );

  const repeat = useCallback(
    async (text: string | null) => {
      if (!turn || stateRef.current.phase !== "teach") return;
      if (text !== null) {
        const trimmed = text.trim();
        setLastHeard(trimmed);
        if (isDontKnowAnswer(trimmed)) {
          if (teach?.modelAnswerJa) {
            void talkSpeech.speakTalkJapanese(`${teach.modelAnswerJa} 「${teach.modelAnswer}」って まねして いってみよう`);
          }
          return;
        }
      }
      // 「いえたよ」ボタン(text=null)は自己申告でかぞえる。声のときはサーバーで判定する。
      const ok =
        text === null
          ? true
          : Boolean((await postCheck({ sceneId: scene.id, turnId: turn.id, answer: text, mode: "repeat" }))?.correct);
      if (!ok) {
        const retryFeedbackEn = teach?.modelAnswer
          ? `Almost! Try saying: ${teach.modelAnswer}`
          : "Almost! Try saying it again.";
        setMessage(retryFeedbackEn);
        void talkSpeech.speakTalkEnglish(retryFeedbackEn, "think");
        return;
      }
      soundManager.playCorrect();
      const nextCount = stateRef.current.repeatCount + 1;
      setState((current) => repeatTalk(current, true));
      setMood("celebrate");
      setMessage("Great! じょうず！");

      // リピート目標達成時、直接対話モードなら自動で次へ
      if (nextCount >= REPEAT_TARGET && directVoiceRef.current) {
        scheduleAutoNext(800);
      }
    },
    [scene.id, scheduleAutoNext, teach, turn],
  );

  const restart = useCallback(() => {
    clearAutoNextTimer();
    talkSpeech.stopTalkSpeech();
    chosenFruitRef.current = null;
    setChosenFruit(null);
    setState(startTalk(turnIds));
    setTeach(null);
    setShowJapanese(false);
    setLastHeard(null);
    setMood("happy");
    setMessage(null);
    setStarted(false);
  }, [clearAutoNextTimer, turnIds]);

  return {
    state,
    turn,
    turnIndex,
    totalTurns: scene.turns.length,
    started,
    teach,
    showJapanese,
    lastHeard,
    message,
    mood,
    checking,
    speaking,
    directVoiceMode,
    setDirectVoiceMode,
    begin,
    sayPrompt: () => sayPrompt(turn),
    askInJapanese,
    answer,
    repeat,
    next,
    restart,
  };
}
