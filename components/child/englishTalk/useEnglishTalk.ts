"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  answerTalk,
  currentTurnId,
  nextTalk,
  repeatTalk,
  startTalk,
  type TalkState,
} from "@/lib/englishTalk/flow";
import type { PublicTalkScene, PublicTalkTurn } from "@/lib/englishTalk/judge";
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

  const turn: PublicTalkTurn | undefined = scene.turns.find(({ id }) => id === currentTurnId(state));

  useEffect(() => () => stopTalkSpeech(), []);

  const sayPrompt = useCallback((target?: PublicTalkTurn) => {
    if (target) void speakTalkEnglish(target.prompt);
  }, []);

  const begin = useCallback(() => {
    setStarted(true);
    sayPrompt(turn);
  }, [sayPrompt, turn]);

  const askInJapanese = useCallback(() => {
    if (!turn) return;
    setShowJapanese(true);
    void speakTalkJapanese(`${turn.promptJa} ${turn.answerHintJa}`);
  }, [turn]);

  const answer = useCallback(
    async (text: string, mode: Exclude<CheckMode, "repeat">) => {
      if (!turn || checking || state.phase !== "ask") return;
      setChecking(true);
      const result = await postCheck({ sceneId: scene.id, turnId: turn.id, answer: text, mode, childId });
      setChecking(false);
      if (!result) {
        setMessage("うまく きこえなかったよ。もういちど おしえてね");
        return;
      }
      setState((current) => answerTalk(current, result.correct));
      if (result.correct) {
        const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
        setMood("celebrate");
        setMessage(result.feedback ?? `${praise} ばっちり つたわったよ！`);
        soundManager.playCorrect();
        void speakTalkEnglish(praise, "celebrate");
        return;
      }
      soundManager.playWrong();
      setMood("think");
      setTeach({
        modelAnswer: result.modelAnswer ?? "",
        modelAnswerJa: result.modelAnswerJa ?? "",
      });
      setMessage("おしい！ こう いうと つたわるよ");
      if (result.modelAnswer) void speakTalkEnglish(result.modelAnswer, "think");
    },
    [checking, childId, scene.id, state.phase, turn],
  );

  const repeat = useCallback(
    async (text: string | null) => {
      if (!turn || state.phase !== "teach") return;
      // 「いえたよ」ボタン(text=null)は自己申告でかぞえる。声のときはサーバーで判定する。
      const ok =
        text === null
          ? true
          : Boolean((await postCheck({ sceneId: scene.id, turnId: turn.id, answer: text, mode: "repeat" }))?.correct);
      if (!ok) {
        setMessage("いいね！ もう いちど、ゆっくり いってみよう");
        return;
      }
      soundManager.playCorrect();
      setState((current) => repeatTalk(current, true));
      setMood("celebrate");
      setMessage("じょうず！");
    },
    [scene.id, state.phase, turn],
  );

  const next = useCallback(() => {
    const following = nextTalk(state);
    setState(following);
    setTeach(null);
    setShowJapanese(false);
    setMood("happy");
    setMessage(null);
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
    begin,
    sayPrompt: () => sayPrompt(turn),
    askInJapanese,
    answer,
    repeat,
    next,
    restart,
  };
}
