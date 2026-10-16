"use client";

import { Mic, MicOff, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isDontKnowAnswer } from "@/lib/englishTalk/judge";
import { stripSpeechFillers } from "@/lib/utils/answers";
import styles from "./englishTalk.module.css";

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultItem extends ArrayLike<SpeechRecognitionAlternative> {
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultItem>;
}

type RealtimeSpeechRecognitionConstructor = new () => {
  lang: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop?: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export interface RealtimeTalkMicProps {
  /** キャラクターが発話中・判定中など、自動聞き取りを待機するとき true */
  disabled?: boolean;
  /** キャラクターが現在しゃべっている最中か */
  characterSpeaking?: boolean;
  /** 自動で常時マイクをONにしてリアルタイム対話するか */
  autoListen?: boolean;
  /** 音声が確定したときに呼ばれるコールバック */
  onUtterance: (spokenText: string) => void;
  /** 聞き取り状態の変化通知 */
  onListeningChange?: (listening: boolean) => void;
  /** キャラクターの発話を割り込んで止めるコールバック */
  onInterruptSpeech?: () => void;
}

/**
 * リアルタイム英会話マイク:
 * - キャラクターが話し終わると自動でマイクがONになり、途切れても自動で再接続する
 * - 話している最中の言葉(interimResults)をリアルタイムで画面に表示する
 * - 話し終えて少し間が空いた瞬間(約0.6秒)に即座に送信し、テンポよく会話できる
 */
export function RealtimeTalkMic({
  disabled = false,
  characterSpeaking = false,
  autoListen = true,
  onUtterance,
  onListeningChange,
  onInterruptSpeech,
}: RealtimeTalkMicProps) {
  const [supported, setSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recognitionLang, setRecognitionLang] = useState<"en-US" | "ja-JP">("en-US");

  const activeRef = useRef<InstanceType<RealtimeSpeechRecognitionConstructor> | null>(null);
  const interimRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const manualPauseRef = useRef(false);
  const committedInSessionRef = useRef(false);

  const propsRef = useRef({
    disabled,
    characterSpeaking,
    autoListen,
    recognitionLang,
    onUtterance,
  });
  propsRef.current = {
    disabled,
    characterSpeaking,
    autoListen,
    recognitionLang,
    onUtterance,
  };

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  useEffect(() => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: RealtimeSpeechRecognitionConstructor;
      webkitSpeechRecognition?: RealtimeSpeechRecognitionConstructor;
    };
    setSupported(Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition));
  }, []);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    clearTimers();
    const current = activeRef.current;
    activeRef.current = null;
    interimRef.current = "";
    if (current) {
      current.onresult = null;
      current.onerror = null;
      current.onend = null;
      try {
        current.abort?.();
      } catch {
        // ignore abort errors
      }
    }
    setIsListening(false);
  }, [clearTimers]);

  const commitText = useCallback(
    (rawText: string) => {
      const cleaned = stripSpeechFillers(rawText).trim();
      if (!cleaned) return;
      committedInSessionRef.current = true;
      interimRef.current = "";
      setLiveTranscript("");
      stopRecognition();
      propsRef.current.onUtterance(cleaned);
    },
    [stopRecognition],
  );

  const startRecognition = useCallback(
    (langOverride?: "en-US" | "ja-JP") => {
      const speechWindow = window as typeof window & {
        SpeechRecognition?: RealtimeSpeechRecognitionConstructor;
        webkitSpeechRecognition?: RealtimeSpeechRecognitionConstructor;
      };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) return;

      stopRecognition();
      committedInSessionRef.current = false;

      try {
        const recognition = new Recognition();
        activeRef.current = recognition;
        recognition.lang = langOverride ?? propsRef.current.recognitionLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 5;

        recognition.onresult = (event) => {
          if (activeRef.current !== recognition) return;

          let finalChunk = "";
          let interimChunk = "";
          const startIdx = event.resultIndex ?? 0;

          for (let i = startIdx; i < event.results.length; i += 1) {
            const item = event.results[i];
            if (!item || item.length === 0) continue;

            // 複数の認識候補の中に「I don't know / わからない」があれば優先採用
            let chosen = item[0]?.transcript ?? "";
            for (let a = 0; a < item.length; a += 1) {
              const alt = item[a]?.transcript ?? "";
              if (isDontKnowAnswer(alt)) {
                chosen = alt;
                break;
              }
            }

            if (item.isFinal !== false) {
              finalChunk += ` ${chosen}`;
            } else {
              interimChunk += ` ${chosen}`;
            }
          }

          const finalTrimmed = finalChunk.trim();
          const interimTrimmed = interimChunk.trim();

          if (finalTrimmed) {
            clearTimers();
            commitText(finalTrimmed);
            return;
          }

          if (interimTrimmed) {
            interimRef.current = interimTrimmed;
            setLiveTranscript(interimTrimmed);
            if (silenceTimerRef.current !== null) {
              window.clearTimeout(silenceTimerRef.current);
            }
            // 話し終えて620ms静止したらリアルタイムで確定・送信する
            const waitMs = isDontKnowAnswer(interimTrimmed) ? 420 : 620;
            silenceTimerRef.current = window.setTimeout(() => {
              if (interimRef.current.trim()) {
                commitText(interimRef.current);
              }
            }, waitMs);
          }
        };

        recognition.onerror = (event) => {
          if (activeRef.current !== recognition) return;
          const err = event?.error ?? "";
          activeRef.current = null;
          setIsListening(false);

          // 権限拒否以外は、自動対話中なら少し待って自動で再開する
          if (err === "not-allowed" || err === "service-not-allowed") {
            manualPauseRef.current = true;
            return;
          }

          if (
            !manualPauseRef.current &&
            propsRef.current.autoListen &&
            !propsRef.current.disabled &&
            !propsRef.current.characterSpeaking
          ) {
            restartTimerRef.current = window.setTimeout(() => {
              startRecognition();
            }, 300);
          }
        };

        recognition.onend = () => {
          if (activeRef.current !== recognition) return;
          activeRef.current = null;
          setIsListening(false);

          // もし interim に話した内容が残っていたら捨てずに確定させる
          if (!committedInSessionRef.current && interimRef.current.trim()) {
            const leftover = interimRef.current;
            commitText(leftover);
            return;
          }

          // まだ自分の番なら、途切れず自動でまた聞き取りを続ける
          if (
            !manualPauseRef.current &&
            propsRef.current.autoListen &&
            !propsRef.current.disabled &&
            !propsRef.current.characterSpeaking
          ) {
            restartTimerRef.current = window.setTimeout(() => {
              startRecognition();
            }, 220);
          }
        };

        recognition.start();
        setIsListening(true);
      } catch {
        activeRef.current = null;
        setIsListening(false);
      }
    },
    [clearTimers, commitText, stopRecognition],
  );

  // キャラクターが話し終えたら自動でマイクON、話し始めたらマイクを一時停止
  useEffect(() => {
    if (!supported) return;
    if (disabled || characterSpeaking || !autoListen || manualPauseRef.current) {
      stopRecognition();
      return;
    }
    const timer = window.setTimeout(() => {
      if (!activeRef.current) {
        startRecognition();
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [autoListen, characterSpeaking, disabled, startRecognition, stopRecognition, supported]);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  const handleMicToggle = () => {
    if (characterSpeaking) {
      onInterruptSpeech?.();
      manualPauseRef.current = false;
      window.setTimeout(() => startRecognition(), 120);
      return;
    }
    if (isListening) {
      manualPauseRef.current = true;
      stopRecognition();
    } else {
      manualPauseRef.current = false;
      startRecognition();
    }
  };

  const handleLangSwitch = (nextLang: "en-US" | "ja-JP") => {
    setRecognitionLang(nextLang);
    manualPauseRef.current = false;
    if (characterSpeaking) onInterruptSpeech?.();
    window.setTimeout(() => startRecognition(nextLang), 80);
  };

  if (!supported) return null;

  return (
    <div className={styles.realtimeMicBox}>
      <div className={styles.realtimeMicRow}>
        <button
          type="button"
          onClick={handleMicToggle}
          disabled={disabled}
          className={`${styles.realtimeMicButton} ${isListening ? styles.realtimeMicActive : ""}`}
          aria-pressed={isListening}
        >
          {characterSpeaking ? (
            <>
              <Volume2 size={22} aria-hidden="true" />
              <span>相手の声をきいています（タップですぐ話す）</span>
            </>
          ) : isListening ? (
            <>
              <span className={styles.micWaveBars} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
              <Mic size={22} aria-hidden="true" />
              <span>マイクON・そのまま声で話してね！</span>
            </>
          ) : (
            <>
              <MicOff size={22} aria-hidden="true" />
              <span>こえで こたえる（タップでマイクON）</span>
            </>
          )}
        </button>

        <div className={styles.langModeSwitch} role="group" aria-label="音声認識モード">
          <button
            type="button"
            className={`${styles.langChip} ${recognitionLang === "en-US" ? styles.langChipActive : ""}`}
            onClick={() => handleLangSwitch("en-US")}
            disabled={disabled}
          >
            🇺🇸 英語で話す
          </button>
          <button
            type="button"
            className={`${styles.langChip} ${recognitionLang === "ja-JP" ? styles.langChipActive : ""}`}
            onClick={() => handleLangSwitch("ja-JP")}
            disabled={disabled}
          >
            🇯🇵 日本語(わからない等)
          </button>
        </div>
      </div>

      {liveTranscript && (
        <div className={styles.liveTranscriptBar} data-testid="live-transcript">
          🎙️ 聞き取り中: <strong>「{liveTranscript}」</strong>
        </div>
      )}
    </div>
  );
}
