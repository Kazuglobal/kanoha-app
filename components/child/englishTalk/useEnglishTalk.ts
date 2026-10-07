"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerTalk,
  currentTurnId,
  nextTalk,
  repeatTalk,
  startTalk,
  type TalkState,
} from "@/lib/englishTalk/flow";
import {
  pickPhrase,
  TALK_ASK_AGAIN,
  TALK_ENCOURAGE,
  TALK_REPEAT_RETRY,
  TALK_RETRY_SUCCESS,
} from "@/lib/englishTalk/feedback";
import type { PublicTalkScene, PublicTalkTurn } from "@/lib/englishTalk/judge";
import { preloadCoachVoices } from "@/lib/audio/coachSpeech";
import { speakTalkEnglish, speakTalkJapanese, stopTalkSpeech } from "@/lib/audio/englishTalkSpeech";
import { soundManager } from "@/lib/audio/soundSystem";
import type { TalkMood } from "./TalkCharacter";

export interface TalkTeach {
  modelAnswer: string;
  modelAnswerJa: string;
}

type CheckMode = "choice" | "voice" | "repeat";

interface CheckResult {
  correct: boolean;
  feedback?: string;
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
 * 英会話れんしゅうの状態と操作。声はすべて子どものタップをきっかけに鳴らす(自動再生しない)。
 */
export function useEnglishTalk(scene: PublicTalkScene, childId?: string) {
  const turnIds = useMemo(() => scene.turns.map(({ id }) => id), [scene]);
  const [state, setState] = useState<TalkState>(() => startTalk(turnIds));
  const [started, setStarted] = useState(false);
  const [teach, setTeach] = useState<TalkTeach | null>(null);
  const [showJapanese, setShowJapanese] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<TalkMood>("happy");
  const [checking, setChecking] = useState(false);
  /** 音声認識で聞こえたことば(画面に出すだけで、保存しない) */
  const [heard, setHeard] = useState<string | null>(null);
  /** まねが聞き取れなかった回数(多いときは「いえたよ」で進めるようにする) */
  const [repeatFails, setRepeatFails] = useState(0);
  const missCountRef = useRef(0);
  // 遅れて届いた声のこたえ(古い描画のコールバック)でも、いまの状態で判断する
  const stateRef = useRef(state);
  const checkingRef = useRef(false);
  stateRef.current = state;

  const turn: PublicTalkTurn | undefined = scene.turns.find(({ id }) => id === currentTurnId(state));

  useEffect(() => () => stopTalkSpeech(), []);

  const sayPrompt = useCallback((target?: PublicTalkTurn) => {
    if (target) void speakTalkEnglish(target.prompt);
  }, []);

  const begin = useCallback(() => {
    setStarted(true);
    preloadCoachVoices(TALK_ENCOURAGE);
    sayPrompt(turn);
  }, [sayPrompt, turn]);

  const askInJapanese = useCallback(() => {
    if (!turn) return;
    setShowJapanese(true);
    void speakTalkJapanese(`${turn.promptJa} ${turn.answerHintJa}`);
  }, [turn]);

  const answer = useCallback(
    async (text: string, mode: Exclude<CheckMode, "repeat">) => {
      const currentId = currentTurnId(stateRef.current);
      if (!turn || turn.id !== currentId || checkingRef.current || stateRef.current.phase !== "ask") return;
      checkingRef.current = true;
      setChecking(true);
      const result = await postCheck({ sceneId: scene.id, turnId: turn.id, answer: text, mode, childId });
      checkingRef.current = false;
      setChecking(false);
      if (!result) {
        setMessage("うまく きこえなかったよ。もういちど おしえてね");
        return;
      }
      setHeard(mode === "voice" ? text : null);
      setState((current) => answerTalk(current, result.correct));
      if (result.correct) {
        const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
        setMood("celebrate");
        setMessage(
          result.feedback ?? (stateRef.current.isRetry ? TALK_RETRY_SUCCESS : `${praise} ばっちり つたわったよ！`),
        );
        soundManager.playCorrect();
        void speakTalkEnglish(praise, "celebrate");
        return;
      }
      // まちがえたら、すぐに はげまして正しい言い方を聞かせる
      const encourage = pickPhrase(TALK_ENCOURAGE, missCountRef.current);
      missCountRef.current += 1;
      soundManager.playWrong();
      setMood("think");
      setRepeatFails(0);
      setTeach({
        modelAnswer: result.modelAnswer ?? "",
        modelAnswerJa: result.modelAnswerJa ?? "",
      });
      setMessage(encourage);
      const model = result.modelAnswer;
      void speakTalkJapanese(encourage).then(() => (model ? speakTalkEnglish(model, "think") : undefined));
    },
    [childId, scene.id, turn],
  );

  const repeat = useCallback(
    async (text: string | null) => {
      if (!turn || stateRef.current.phase !== "teach") return;
      // 「いえたよ」ボタン(text=null)は自己申告でかぞえる。声のときはサーバーで判定する。
      const ok =
        text === null
          ? true
          : Boolean((await postCheck({ sceneId: scene.id, turnId: turn.id, answer: text, mode: "repeat" }))?.correct);
      if (stateRef.current.phase !== "teach") return;
      setHeard(text);
      if (!ok) {
        setMessage(pickPhrase(TALK_REPEAT_RETRY, repeatFails));
        setRepeatFails((count) => count + 1);
        if (teach?.modelAnswer) void speakTalkEnglish(teach.modelAnswer, "think");
        return;
      }
      soundManager.playCorrect();
      const following = repeatTalk(stateRef.current, true);
      stateRef.current = following;
      setState(following);
      if (following.phase === "ask") {
        // まねできたら、おなじ質問をすぐにもう1回きく
        setTeach(null);
        setHeard(null);
        setMood("happy");
        setMessage(TALK_ASK_AGAIN);
        sayPrompt(turn);
        return;
      }
      setMood("celebrate");
      setMessage(following.phase === "correct" ? "じょうず！ つぎに いこう" : "じょうず！ もう いっかい いってみよう");
    },
    [repeatFails, sayPrompt, scene.id, teach, turn],
  );

  const next = useCallback(() => {
    const following = nextTalk(state);
    setState(following);
    setTeach(null);
    setShowJapanese(false);
    setMood("happy");
    setMessage(null);
    setHeard(null);
    setRepeatFails(0);
    const nextTurn = scene.turns.find(({ id }) => id === currentTurnId(following));
    if (following.phase === "ask") sayPrompt(nextTurn);
  }, [sayPrompt, scene.turns, state]);

  const restart = useCallback(() => {
    stopTalkSpeech();
    setState(startTalk(turnIds));
    setTeach(null);
    setShowJapanese(false);
    setMood("happy");
    setMessage(null);
    setHeard(null);
    setRepeatFails(0);
    setStarted(false);
  }, [turnIds]);

  return {
    state,
    turn,
    started,
    teach,
    showJapanese,
    message,
    mood,
    checking,
    heard,
    repeatFails,
    begin,
    sayPrompt: () => sayPrompt(turn),
    askInJapanese,
    answer,
    repeat,
    next,
    restart,
  };
}
