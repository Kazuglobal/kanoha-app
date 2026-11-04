"use client";

import { useCallback, useMemo, useRef } from "react";
import * as talkSpeech from "@/lib/audio/englishTalkSpeech";

/**
 * 英会話の読み上げ。親の設定で音を切ってあるとき(enableAudio=false)は、音声 API を一切呼ばない。
 * 引数はそのまま渡す(mood を省いたときは省いたまま)。
 * 返す値は enabled が変わらない限り同じ参照(useEffect の依存に入れても毎回は走らない)。
 */
export function useTalkSpeech(enabled: boolean) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const speakEnglish = useCallback(
    (...args: Parameters<typeof talkSpeech.speakTalkEnglish>) =>
      enabledRef.current ? talkSpeech.speakTalkEnglish(...args) : Promise.resolve(),
    [],
  );
  const speakJapanese = useCallback(
    (...args: Parameters<typeof talkSpeech.speakTalkJapanese>) =>
      enabledRef.current ? talkSpeech.speakTalkJapanese(...args) : Promise.resolve(),
    [],
  );
  const preload = useCallback((prompts: readonly string[]) => {
    if (enabledRef.current) talkSpeech.preloadTalkSceneSpeech?.(prompts);
  }, []);
  const stop = useCallback(() => talkSpeech.stopTalkSpeech(), []);

  return useMemo(
    () => ({ enabled, speakEnglish, speakJapanese, preload, stop }),
    [enabled, speakEnglish, speakJapanese, preload, stop],
  );
}
