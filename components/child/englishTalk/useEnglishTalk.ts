"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { soundManager } from "@/lib/audio/soundSystem";
import { postCheck, type CheckOutcome, type CheckResult } from "@/lib/englishTalk/checkClient";
import { adaptTurn, type ChosenFruit, type FruitId } from "@/lib/englishTalk/context";
import {
  answerTalk,
  currentTurnId,
  markHelp,
  nextTalk,
  repeatTalk,
  startTalk,
  talkStarsOf,
  type TalkState,
} from "@/lib/englishTalk/flow";
import {
  buildCorrectiveFeedbackEn,
  detectChosenFruit,
  isDontKnowAnswer,
  type PublicTalkScene,
  type PublicTalkTurn,
} from "@/lib/englishTalk/judge";
import { recordEnglishTalkSceneClear } from "@/lib/englishTalk/progressStore";
import { applyServerReward, recordCorrectAnswer } from "@/lib/rewards/rewardStore";
import type { TalkMood } from "./TalkCharacter";
import { TALK_FAILURE_MESSAGES, TALK_MESSAGES, TALK_PRAISE } from "./talkMessages";
import { useTalkSpeech } from "./useTalkSpeech";

export interface TalkTeach {
  feedbackEn: string;
  modelAnswer: string;
  modelAnswerJa: string;
}

/** 終わったあとに見直す、おてほんを見たターンのフレーズ。 */
export interface TaughtPhrase extends TalkTeach {
  turnId: string;
}

export interface UseEnglishTalkOptions {
  /** 親の設定。false なら読み上げの音声 API を呼ばない */
  enableAudio?: boolean;
  /** 親の設定。false なら声では答えられず、4択だけで答える(4択で答えてもヘルプにしない) */
  enableVoiceAnswer?: boolean;
}

const praiseWord = () => TALK_PRAISE[Math.floor(Math.random() * TALK_PRAISE.length)];

/** 「いえたよ！」を続けて(ダブルタップで)押しても、1回ぶんだけ数える間隔(ミリ秒)。 */
const SELF_REPORT_GAP_MS = 350;

/**
 * 英会話れんしゅうの状態と操作。
 * - 声(en-US)で対話する。ログイン中の子はマイクが自動、デモはタップした1回だけ聞く
 * - 「I don't know」「わからない」と言ったら日本語にして教える(ヘルプ)
 * - まちがえたらすぐ英語で正しいフィードバックを返し、まねして言ってもらう
 * - 次の問いは「つぎへ」をタップしたときだけ読む(CLAUDE.md: 音声は手動再生)。ほめ・おしえは答えへの返事なので自動
 * - 1回目の正解でごほうびメーターを進め、終わったら ★(ヘルプ・おてほんで下がる)を記録する
 */
export function useEnglishTalk(scene: PublicTalkScene, childId?: string, options: UseEnglishTalkOptions = {}) {
  const speech = useTalkSpeech(options.enableAudio !== false);
  const turnIds = useMemo(() => scene.turns.map(({ id }) => id), [scene]);
  const [state, setState] = useState<TalkState>(() => startTalk(turnIds));
  const [started, setStarted] = useState(false);
  const [teach, setTeach] = useState<TalkTeach | null>(null);
  const [taught, setTaught] = useState<readonly TaughtPhrase[]>([]);
  const [showJapanese, setShowJapanese] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mood, setMood] = useState<TalkMood>("happy");
  const [checking, setChecking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const [chosenFruit, setChosenFruit] = useState<ChosenFruit | null>(null);
  // ログイン中は自動で聞く(今までどおり)。デモは、ボタンを押した1回の発話だけ聞く。
  const listenMode = childId ? "auto" : "tap";
  const [autoMic, setAutoMic] = useState(listenMode === "auto");
  /** このまねして言うで、合わなかった回数(2回で「いえたよ！」でも進められる。使えるようになったら、終わるまで出したまま) */
  const [repeatMisses, setRepeatMisses] = useState(0);
  /** 変わるとマイクを入れなおす(自動モードで、答えのあとに もう一度聞き始めるため) */
  const [micKey, setMicKey] = useState(0);
  const restartMic = useCallback(() => setMicKey((key) => key + 1), []);
  // 声のこたえが親の設定でオフ・マイクが使えないときは、4択が「ふつうの答え方」なのでヘルプにしない
  const choicesForced = options.enableVoiceAnswer === false || voiceUnavailable;

  // 遅れて届いた声や、続けて押されたボタンでも、いまの状態で判断するための参照(commit で即座に合わせる)
  const stateRef = useRef(state);
  const checkingRef = useRef(false);
  const repeatingRef = useRef(false);
  const lastSelfReportRef = useRef(0);
  /** 「もういちど」でやり直す・画面を離れるたびに増やす。待っているあいだに変わったら、古い答え合わせの結果は捨てる。 */
  const runRef = useRef(0);
  const chosenFruitRef = useRef<ChosenFruit | null>(null);
  const choicesForcedRef = useRef(choicesForced);
  stateRef.current = state;
  chosenFruitRef.current = chosenFruit;
  choicesForcedRef.current = choicesForced;

  const commit = useCallback((next: TalkState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const activeTurnId = currentTurnId(state);
  const rawTurn: PublicTalkTurn | undefined = scene.turns.find(({ id }) => id === activeTurnId);
  const fruitId = (chosenFruit?.singular ?? null) as FruitId | null;
  const turn = useMemo(() => (rawTurn ? adaptTurn(rawTurn, { fruit: fruitId }) : undefined), [rawTurn, fruitId]);
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const turnIndex = useMemo(() => {
    const index = scene.turns.findIndex(({ id }) => id === activeTurnId);
    return index >= 0 ? index : 0;
  }, [activeTurnId, scene.turns]);

  // 画面を離れたら、読み上げを止め、待っている答え合わせの結果(音・読み上げ)も出さない
  useEffect(
    () => () => {
      runRef.current += 1;
      speech.stop();
    },
    [speech],
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

  // 最後のターンに答えた時点で ★ が決まる(「つぎへ」を押さずに離れても記録が残るよう、ここで記録する)
  const isLastStep = state.phase === "correct" && nextTalk(state).phase === "done";
  useEffect(() => {
    if (state.phase === "done" || isLastStep) recordEnglishTalkSceneClear(scene.id, talkStarsOf(state), childId);
  }, [childId, isLastStep, scene.id, state]);

  const sayPrompt = useCallback(
    (target: PublicTalkTurn | undefined = turnRef.current) => {
      if (target) void speech.speakEnglish(target.prompt);
    },
    [speech],
  );

  const begin = useCallback(() => {
    setStarted(true);
    setLastHeard(null);
    speech.preload(scene.turns.map(({ prompt }) => prompt));
    sayPrompt();
  }, [sayPrompt, scene.turns, speech]);

  /** 「つぎへ」: 次の問いへ進み、その問いを読む(タップが読み上げのきっかけ)。連打しても1回だけ進む。 */
  const next = useCallback(() => {
    const following = nextTalk(stateRef.current);
    if (following === stateRef.current) return;
    commit(following);
    const nextRaw = scene.turns.find(({ id }) => id === currentTurnId(following));
    const nextFruit = (chosenFruitRef.current?.singular ?? null) as FruitId | null;
    setTeach(null);
    setRepeatMisses(0);
    setShowJapanese(false);
    setLastHeard(null);
    setMood("happy");
    setMessage(null);
    if (following.phase === "ask" && nextRaw) sayPrompt(adaptTurn(nextRaw, { fruit: nextFruit }));
  }, [commit, sayPrompt, scene.turns]);

  /** 4択を開いた・4択で答えた = ヘルプ(★が少し下がる)。4択しか使えないときは、ふつうの答え方なので数えない。 */
  const noteHelp = useCallback(() => {
    if (!choicesForcedRef.current) commit(markHelp(stateRef.current));
  }, [commit]);

  /** ヘルプ: 日本語で問いとヒントを出して読む。不正解にはしない(★が少し下がる)。 */
  const askInJapanese = useCallback(() => {
    const target = turnRef.current;
    if (!target) return;
    commit(markHelp(stateRef.current));
    setShowJapanese(true);
    setMood("think");
    setMessage(TALK_MESSAGES.japaneseHelp);
    void speech.speakJapanese(`${target.promptJa} ${target.answerHintJa}`);
  }, [commit, speech]);

  const showFailure = useCallback(
    (outcome: Extract<CheckOutcome, { ok: false }>) => {
      setMessage(TALK_FAILURE_MESSAGES[outcome.reason]);
      restartMic();
    },
    [restartMic],
  );

  const handleCorrect = useCallback(
    async (target: PublicTalkTurn, spoken: string, result: CheckResult, wasFirstTry: boolean) => {
      if (target.id === "shop-want") {
        const detected = detectChosenFruit(spoken);
        if (detected) {
          chosenFruitRef.current = detected;
          setChosenFruit(detected);
        }
      }
      if (wasFirstTry) {
        // ログイン中はサーバーが数えた分だけを表示へ反映する。端末だけで数えるのは未ログイン(デモ)のとき。
        if (childId) applyServerReward(result.reward);
        else recordCorrectAnswer();
      }
      setMood("celebrate");
      setMessage(result.feedback ?? `${praiseWord()} ${TALK_MESSAGES.praise}`);
      soundManager.playCorrect();
      await speech.speakEnglish(praiseWord(), "celebrate");
    },
    [childId, speech],
  );

  const handleWrong = useCallback(
    (target: PublicTalkTurn, result: CheckResult) => {
      soundManager.playWrong();
      setMood("think");
      const modelAnswer = result.modelAnswer ?? "";
      const feedbackEn = buildCorrectiveFeedbackEn(modelAnswer, result.feedbackEn);
      const info: TalkTeach = { feedbackEn, modelAnswer, modelAnswerJa: result.modelAnswerJa ?? "" };
      setTeach(info);
      setRepeatMisses(0);
      setTaught((list) => (list.some(({ turnId }) => turnId === target.id) ? list : [...list, { turnId: target.id, ...info }]));
      setMessage(feedbackEn);
      void speech.speakEnglish(feedbackEn, "think");
    },
    [speech],
  );

  /** 声・文字・4択のこたえを答え合わせする。 */
  const answer = useCallback(
    async (text: string, mode: "voice" | "choice" = "voice") => {
      const target = turnRef.current;
      const before = stateRef.current;
      if (!target || checkingRef.current || before.phase !== "ask" || target.id !== currentTurnId(before)) return;
      const spoken = text.trim();
      if (!spoken) return;

      setLastHeard(spoken);
      // 「I don't know」「わからない」と言ったら日本語にして教える(不正解にはしない)
      if (mode === "voice" && isDontKnowAnswer(spoken)) {
        askInJapanese();
        return;
      }
      if (mode === "choice") noteHelp();

      // 1回目でできたかは、答え合わせの前の状態で決める(ごほうびの対象かどうかをサーバーへ申告する。ヘルプを使っても1回目)
      const wasFirstTry = !before.isRetry && !before.missed.includes(target.id);
      const run = runRef.current;
      checkingRef.current = true;
      setChecking(true);
      const outcome = await postCheck({
        sceneId: scene.id,
        turnId: target.id,
        answer: spoken,
        mode,
        ...(childId ? { childId } : {}),
        firstTry: wasFirstTry,
        ...(chosenFruitRef.current ? { context: { fruit: chosenFruitRef.current.singular } } : {}),
      });
      if (runRef.current !== run) return; // やり直したあとに届いた古い結果(フラグは restart が戻している)
      checkingRef.current = false;
      setChecking(false);

      // 待っているあいだに次の問いへ移っていたら、古い結果は使わない
      const now = stateRef.current;
      if (now.phase !== "ask" || currentTurnId(now) !== target.id) return;
      if (!outcome.ok) return showFailure(outcome);
      if (outcome.data.isDontKnow) return askInJapanese();
      if (outcome.data.needsEnglish || outcome.data.unclear) {
        // まちがいにはしない。もう一度言えるように、マイクを入れなおす
        setMood("think");
        setMessage(outcome.data.unclear ? TALK_MESSAGES.unclear : TALK_MESSAGES.needsEnglish);
        restartMic();
        return;
      }

      commit(answerTalk(now, outcome.data.correct));
      if (outcome.data.correct) await handleCorrect(target, spoken, outcome.data, wasFirstTry);
      else handleWrong(target, outcome.data);
    },
    [askInJapanese, childId, commit, handleCorrect, handleWrong, noteHelp, restartMic, scene.id, showFailure],
  );

  /** まねして言う。text=null は「いえたよ！」(声が使えないときの自己申告)。処理中の2回目は無視する。 */
  const repeat = useCallback(
    async (text: string | null) => {
      const target = turnRef.current;
      if (!target || stateRef.current.phase !== "teach" || repeatingRef.current) return;
      if (text === null) {
        // 判定をとおらない自己申告は、続けて2回押されても1回ぶんだけ数える
        const now = Date.now();
        if (now - lastSelfReportRef.current < SELF_REPORT_GAP_MS) return;
        lastSelfReportRef.current = now;
      } else {
        const spoken = text.trim();
        setLastHeard(spoken);
        if (isDontKnowAnswer(spoken)) {
          if (teach?.modelAnswerJa) {
            void speech.speakJapanese(`${teach.modelAnswerJa} 「${teach.modelAnswer}」って まねして いってみよう`);
          }
          return;
        }
      }

      const run = runRef.current;
      repeatingRef.current = true;
      try {
        const outcome =
          text === null
            ? null
            : await postCheck({ sceneId: scene.id, turnId: target.id, answer: text.trim(), mode: "repeat" });
        if (runRef.current !== run || stateRef.current.phase !== "teach") return;
        if (outcome && !outcome.ok) return showFailure(outcome);
        if (outcome && !outcome.data.correct) {
          const retry = teach?.modelAnswer
            ? `Almost! Try saying: ${teach.modelAnswer}`
            : "Almost! Try saying it again.";
          setMessage(retry);
          setRepeatMisses((count) => count + 1);
          restartMic();
          void speech.speakEnglish(retry, "think");
          return;
        }
        soundManager.playCorrect();
        commit(repeatTalk(stateRef.current, true));
        restartMic();
        setMood("celebrate");
        setMessage(TALK_MESSAGES.repeatDone);
      } finally {
        if (runRef.current === run) repeatingRef.current = false;
      }
    },
    [commit, restartMic, scene.id, showFailure, speech, teach],
  );

  const restart = useCallback(() => {
    speech.stop();
    runRef.current += 1;
    checkingRef.current = false;
    repeatingRef.current = false;
    setChecking(false);
    chosenFruitRef.current = null;
    setChosenFruit(null);
    commit(startTalk(turnIds));
    setTeach(null);
    setTaught([]);
    setRepeatMisses(0);
    setShowJapanese(false);
    setLastHeard(null);
    setMood("happy");
    setMessage(null);
    setStarted(false);
  }, [commit, speech, turnIds]);

  return {
    state,
    turn,
    turnIndex,
    totalTurns: scene.turns.length,
    started,
    teach,
    taught,
    showJapanese,
    lastHeard,
    message,
    mood,
    checking,
    speaking,
    audioEnabled: speech.enabled,
    speakEnglish: speech.speakEnglish,
    stopSpeech: speech.stop,
    listenMode,
    /** マイクを自動で入れるか(デモは常に false) */
    autoMic,
    setAutoMic: (enabled: boolean) => setAutoMic(listenMode === "auto" && enabled),
    voiceUnavailable,
    markVoiceUnavailable: () => setVoiceUnavailable(true),
    /** 4択しか使えない(親の設定でオフ・マイクが使えない) */
    choicesForced,
    /** マイク部品の key。変わると入れなおす(答えのあとに もう一度聞き始める) */
    micKey,
    repeatMisses,
    /** いまの答えが最後。つぎへ のかわりに「おわる」を出す */
    isLastStep,
    fruitId,
    begin,
    sayPrompt: () => sayPrompt(),
    askInJapanese,
    noteHelp,
    answer,
    repeat,
    next,
    restart,
  };
}
