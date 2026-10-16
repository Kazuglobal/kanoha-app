"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerTalk,
  currentTurnId,
  nextTalk,
  repeatTalk,
  REPEAT_TARGET,
  startTalk,
  type TalkState,
} from "@/lib/englishTalk/flow";
import {
  buildCorrectiveFeedbackEn,
  isDontKnowAnswer,
  type PublicTalkScene,
  type PublicTalkTurn,
} from "@/lib/englishTalk/judge";
import { speakTalkEnglish, speakTalkJapanese, stopTalkSpeech } from "@/lib/audio/englishTalkSpeech";
import { soundManager } from "@/lib/audio/soundSystem";
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

/**
 * 英会話れんしゅうの状態と操作。
 * - 声(en-US)でキャラクターと対話する
 * - 「I don't know」「わからない」と言ったら日本語にして教える
 * - まちがえたらすぐ英語で正しいフィードバックを返す
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

  // 遅れて届いた声のこたえ(古い描画のコールバック)でも、いまの状態で判断する
  const stateRef = useRef(state);
  const checkingRef = useRef(false);
  const directVoiceRef = useRef(true);
  stateRef.current = state;
  directVoiceRef.current = directVoiceMode;

  const activeTurnId = currentTurnId(state);
  const turn: PublicTalkTurn | undefined = scene.turns.find(({ id }) => id === activeTurnId);
  const turnIndex = useMemo(() => {
    const idx = scene.turns.findIndex(({ id }) => id === activeTurnId);
    return idx >= 0 ? idx : 0;
  }, [activeTurnId, scene.turns]);

  useEffect(() => () => stopTalkSpeech(), []);

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

  const sayPrompt = useCallback((target?: PublicTalkTurn) => {
    if (target) void speakTalkEnglish(target.prompt);
  }, []);

  const begin = useCallback(() => {
    setStarted(true);
    setLastHeard(null);
    sayPrompt(turn);
  }, [sayPrompt, turn]);

  const askInJapanese = useCallback(() => {
    if (!turn) return;
    setShowJapanese(true);
    setMood("think");
    setMessage("にほんごに したよ！ きいてから えいごで はなしてみよう");
    void speakTalkJapanese(`${turn.promptJa} ${turn.answerHintJa}`);
  }, [turn]);

  const next = useCallback(() => {
    setState((current) => {
      const following = nextTalk(current);
      const nextTurn = scene.turns.find(({ id }) => id === currentTurnId(following));
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
  }, [sayPrompt, scene.turns]);

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

      setState((current) => answerTalk(current, result.correct));
      if (result.correct) {
        const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
        setMood("celebrate");
        setMessage(result.feedback ?? `${praise} ばっちり つたわったよ！`);
        soundManager.playCorrect();
        void speakTalkEnglish(praise, "celebrate");

        // 直接対話モードのときは、褒め言葉のあと自動で次のターンへ
        if (directVoiceRef.current) {
          setTimeout(() => {
            next();
          }, 1600);
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
      void speakTalkEnglish(feedbackEn, "think");
    },
    [askInJapanese, childId, next, scene.id, turn],
  );

  const repeat = useCallback(
    async (text: string | null) => {
      if (!turn || stateRef.current.phase !== "teach") return;
      if (text !== null) {
        const trimmed = text.trim();
        setLastHeard(trimmed);
        if (isDontKnowAnswer(trimmed)) {
          if (teach?.modelAnswerJa) {
            void speakTalkJapanese(`${teach.modelAnswerJa} 「${teach.modelAnswer}」って まねして いってみよう`);
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
        void speakTalkEnglish(retryFeedbackEn, "think");
        return;
      }
      soundManager.playCorrect();
      const nextCount = stateRef.current.repeatCount + 1;
      setState((current) => repeatTalk(current, true));
      setMood("celebrate");
      setMessage("Great! じょうず！");

      // リピート目標達成時、直接対話モードなら自動で次へ
      if (nextCount >= REPEAT_TARGET && directVoiceRef.current) {
        setTimeout(() => {
          next();
        }, 1500);
      }
    },
    [next, scene.id, teach, turn],
  );

  const restart = useCallback(() => {
    stopTalkSpeech();
    setState(startTalk(turnIds));
    setTeach(null);
    setShowJapanese(false);
    setLastHeard(null);
    setMood("happy");
    setMessage(null);
    setStarted(false);
  }, [turnIds]);

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
