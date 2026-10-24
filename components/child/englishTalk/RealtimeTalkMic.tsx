"use client";

import { Mic, MicOff, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isDontKnowAnswer, normalizeSpokenEnglish } from "@/lib/englishTalk/judge";
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

/**
 * まだ文の途中で後ろに単語が続く可能性が高いプレフィックス。
 * これだけの段階で isFinal になっても即座にマイクを切らず、少し待って続きの言葉を待つ。
 */
const INCOMPLETE_PREFIXES = new Set([
  "hello",
  "hi",
  "hey",
  "my",
  "my name",
  "my name is",
  "name",
  "name is",
  "i",
  "im",
  "i am",
  "im a",
  "i am a",
  "it",
  "its",
  "it is",
  "its a",
  "its an",
  "it is a",
  "it is an",
  "this",
  "this is",
  "this is a",
  "i like",
  "i want",
  "yes i",
  "no i",
]);

function isIncompleteUtterance(rawText: string): boolean {
  const norm = normalizeSpokenEnglish(rawText);
  if (!norm) return true;
  return INCOMPLETE_PREFIXES.has(norm);
}

export interface RealtimeTalkMicProps {
  /** キャラクターが発話中・判定中など、自動聞き取りを待機するとき true */
  disabled?: boolean;
  /** キャラクターが現在しゃべっている最中か */
  characterSpeaking?: boolean;
  /** 自動で常時マイクをONにしてリアルタイム対話するか */
  autoListen?: boolean;
  /** シーンID（フォールバック音声認識の文脈補助用） */
  sceneId?: string;
  /** ターンID（フォールバック音声認識の文脈補助用） */
  turnId?: string;
  /** 音声が確定したときに呼ばれるコールバック */
  onUtterance: (spokenText: string) => void;
  /** 聞き取り状態の変化通知 */
  onListeningChange?: (listening: boolean) => void;
  /** キャラクターの発話を割り込んで止めるコールバック */
  onInterruptSpeech?: () => void;
  /** マイクボタンをタップしたときに自動マイクONへ連動させるコールバック */
  onAutoListenChange?: (enabled: boolean) => void;
}

/**
 * リアルタイム英会話マイク:
 * - キャラクターが話し終わると自動でマイクがONになり、途切れてもシームレスに再接続する
 * - 話している最中の言葉(interimResults)を全文累積してリアルタイムで画面に表示する
 * - 「Hello... My name is... Yuki」のように途中で息継ぎしても最初の1語で切らず、最後まで聞き取る
 * - Web Speech API がネットワーク制限等でエラーになる環境では、Web Audio VAD + /api/ai/stt へ自動フォールバックする
 */
export function RealtimeTalkMic({
  disabled = false,
  characterSpeaking = false,
  autoListen = true,
  sceneId,
  turnId,
  onUtterance,
  onListeningChange,
  onInterruptSpeech,
  onAutoListenChange,
}: RealtimeTalkMicProps) {
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micHint, setMicHint] = useState<string | null>(null);
  const [recognitionLang, setRecognitionLang] = useState<"en-US" | "ja-JP">("en-US");

  const activeRef = useRef<InstanceType<RealtimeSpeechRecognitionConstructor> | null>(null);
  const interimRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const manualPauseRef = useRef(false);
  const userRequestedListenRef = useRef(false);
  const committedInSessionRef = useRef(false);
  const startedAtRef = useRef(0);
  const listeningRef = useRef(false);
  const sessionTokenRef = useRef(0);

  // Web Audio VAD + MediaRecorder 用
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const vadActiveRef = useRef(false);
  const finalizeVadRef = useRef<(() => Promise<void>) | null>(null);

  const propsRef = useRef({
    disabled,
    characterSpeaking,
    autoListen,
    sceneId,
    turnId,
    recognitionLang,
    onUtterance,
  });
  propsRef.current = {
    disabled,
    characterSpeaking,
    autoListen,
    sceneId,
    turnId,
    recognitionLang,
    onUtterance,
  };

  const setListeningBoth = useCallback((val: boolean) => {
    listeningRef.current = val;
    setIsListening(val);
  }, []);

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

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

  const stopVadStream = useCallback(() => {
    vadActiveRef.current = false;
    finalizeVadRef.current = null;
    if (vadFrameRef.current !== null) {
      window.cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      } catch {
        // ignore
      }
    }
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => undefined);
    }
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const detachRecognition = useCallback(() => {
    const current = activeRef.current;
    activeRef.current = null;
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
  }, []);

  const stopRecognition = useCallback(() => {
    sessionTokenRef.current += 1;
    clearTimers();
    detachRecognition();
    stopVadStream();
    interimRef.current = "";
    setListeningBoth(false);
  }, [clearTimers, detachRecognition, setListeningBoth, stopVadStream]);

  const shouldKeepListening = useCallback(() => {
    const p = propsRef.current;
    if (p.disabled || p.characterSpeaking || manualPauseRef.current) return false;
    return p.autoListen || userRequestedListenRef.current;
  }, []);

  const commitText = useCallback(
    (rawText: string) => {
      const cleaned = stripSpeechFillers(rawText).trim();
      if (!cleaned || committedInSessionRef.current) return;
      committedInSessionRef.current = true;
      userRequestedListenRef.current = false;
      interimRef.current = "";
      setLiveTranscript("");
      setMicHint(null);
      stopRecognition();
      propsRef.current.onUtterance(cleaned);
    },
    [stopRecognition],
  );

  /**
   * マイク聞き取りの開始:
   * 1. Web Speech API が利用可能な場合はまず Web Speech API を起動し、二重録音によるマイク競合を防ぐ。
   * 2. Web Speech API が未対応、または network / not-allowed 等でエラーになった場合は、
   *    即座に getUserMedia + Web Audio VAD + MediaRecorder + /api/ai/stt へシームレスに切り替えてマイク ON を維持する。
   */
  const startRecognition = useCallback(
    (langOverride?: "en-US" | "ja-JP", directFromGesture = false) => {
      const targetLang = langOverride ?? propsRef.current.recognitionLang;

      if (!directFromGesture && (propsRef.current.disabled || propsRef.current.characterSpeaking || manualPauseRef.current)) {
        return;
      }

      sessionTokenRef.current += 1;
      const myToken = sessionTokenRef.current;

      clearTimers();
      detachRecognition();
      stopVadStream();
      committedInSessionRef.current = false;
      interimRef.current = "";
      setListeningBoth(true);
      startedAtRef.current = Date.now();
      setMicHint(null);

      const speechWindow = window as typeof window & {
        SpeechRecognition?: RealtimeSpeechRecognitionConstructor;
        webkitSpeechRecognition?: RealtimeSpeechRecognitionConstructor;
      };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      const hasGetUserMedia = Boolean(
        typeof navigator !== "undefined" &&
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === "function",
      );

      // Web Audio VAD + MediaRecorder + /api/ai/stt フォールバック起動関数
      const startVadFallback = () => {
        if (vadActiveRef.current || !hasGetUserMedia) return;
        vadActiveRef.current = true;
        setListeningBoth(true);
        void (async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });

            if (sessionTokenRef.current !== myToken || committedInSessionRef.current) {
              for (const track of stream.getTracks()) track.stop();
              return;
            }

            mediaStreamRef.current = stream;
            vadActiveRef.current = true;
            setListeningBoth(true);

            const AudioCtx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            const audioCtx = AudioCtx ? new AudioCtx() : null;
            audioCtxRef.current = audioCtx;
            if (audioCtx && audioCtx.state !== "running") {
              void audioCtx.resume().catch(() => undefined);
            }
            const source = audioCtx ? audioCtx.createMediaStreamSource(stream) : null;
            const analyser = audioCtx ? audioCtx.createAnalyser() : null;
            if (source && analyser) {
              analyser.fftSize = 512;
              source.connect(analyser);
            }

            const chunks: BlobPart[] = [];
            let recorder: MediaRecorder | null = null;
            if (typeof MediaRecorder !== "undefined") {
              try {
                recorder = new MediaRecorder(stream);
                mediaRecorderRef.current = recorder;
                recorder.ondataavailable = (e) => {
                  if (e.data && e.data.size > 0) chunks.push(e.data);
                };
                recorder.start(200);
              } catch {
                recorder = null;
              }
            }

            let spokeAt = 0;
            let lastVoiceAt = 0;
            let voiceFrames = 0;
            const streamStartedAt = Date.now();
            const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

            const finalizeVadUtterance = async () => {
              if (sessionTokenRef.current !== myToken || committedInSessionRef.current) return;
              if (interimRef.current.trim()) {
                commitText(interimRef.current);
                return;
              }

              vadActiveRef.current = false;
              setLiveTranscript("声をききとっています...");

              let base64Audio = "";
              let mimeType = "audio/webm";

              if (recorder && recorder.state !== "inactive") {
                await new Promise<void>((resolve) => {
                  if (!recorder) return resolve();
                  recorder.onstop = () => resolve();
                  try {
                    recorder.stop();
                  } catch {
                    resolve();
                  }
                });
                if (chunks.length > 0) {
                  mimeType = recorder.mimeType || "audio/webm";
                  const blob = new Blob(chunks, { type: mimeType });
                  const buffer = await blob.arrayBuffer().catch(() => null);
                  if (buffer) {
                    const bytes = new Uint8Array(buffer);
                    let binary = "";
                    for (let i = 0; i < bytes.length; i += 1) {
                      binary += String.fromCharCode(bytes[i]);
                    }
                    base64Audio = window.btoa(binary);
                  }
                }
              }

              stopVadStream();

              if (sessionTokenRef.current !== myToken || committedInSessionRef.current) return;
              if (interimRef.current.trim()) {
                commitText(interimRef.current);
                return;
              }

              if (!base64Audio || base64Audio.length < 50) {
                setLiveTranscript("");
                if (shouldKeepListening()) {
                  restartTimerRef.current = window.setTimeout(() => {
                    if (sessionTokenRef.current === myToken) startRecognition(targetLang);
                  }, 150);
                } else {
                  setListeningBoth(false);
                }
                return;
              }

              const res = await fetch("/api/ai/stt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audioBase64: base64Audio,
                  mimeType,
                  lang: targetLang,
                  sceneId: propsRef.current.sceneId,
                  turnId: propsRef.current.turnId,
                }),
              }).catch(() => null);

              if (sessionTokenRef.current !== myToken || committedInSessionRef.current) return;

              const json = await res?.json().catch(() => null);
              if (json?.success && typeof json.transcript === "string" && json.transcript.trim()) {
                commitText(json.transcript.trim());
              } else {
                setLiveTranscript("");
                if (shouldKeepListening()) {
                  restartTimerRef.current = window.setTimeout(() => {
                    if (sessionTokenRef.current === myToken) startRecognition(targetLang);
                  }, 150);
                } else {
                  setListeningBoth(false);
                }
              }
            };

            finalizeVadRef.current = finalizeVadUtterance;

            const checkVolume = () => {
              if (sessionTokenRef.current !== myToken || !vadActiveRef.current || !analyser || !dataArray) return;
              analyser.getByteTimeDomainData(dataArray);
              let sumSq = 0;
              for (let i = 0; i < dataArray.length; i += 1) {
                const centered = (dataArray[i] - 128) / 128;
                sumSq += centered * centered;
              }
              const rms = Math.sqrt(sumSq / dataArray.length);
              const now = Date.now();

              if (now - streamStartedAt >= 120) {
                if (rms > 0.025) {
                  voiceFrames += 1;
                  lastVoiceAt = now;
                  if (spokeAt === 0 && voiceFrames >= 5) {
                    spokeAt = now;
                    if (!interimRef.current) {
                      setLiveTranscript("声をききとっています...");
                    }
                  }
                } else if (spokeAt === 0 && voiceFrames > 0 && now - lastVoiceAt > 250) {
                  voiceFrames = 0;
                } else if (
                  spokeAt > 0 &&
                  voiceFrames >= 8 &&
                  now - lastVoiceAt >= 750 &&
                  !(interimRef.current.trim() && silenceTimerRef.current !== null)
                ) {
                  void finalizeVadUtterance();
                  return;
                }
              }

              vadFrameRef.current = window.requestAnimationFrame(checkVolume);
            };

            if (analyser) {
              vadFrameRef.current = window.requestAnimationFrame(checkVolume);
            }
          } catch {
            vadActiveRef.current = false;
            if (!activeRef.current && sessionTokenRef.current === myToken) {
              setListeningBoth(false);
              setMicHint("ブラウザのアドレスバー左のアイコンから「マイク」を許可してね");
            }
          }
        })();
      };

      // A) Web Speech API (リアルタイム字幕 & メイン認識)
      if (Recognition) {
        try {
          const recognition = new Recognition();
          activeRef.current = recognition;
          recognition.lang = targetLang;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 5;

          recognition.onresult = (event) => {
            if (sessionTokenRef.current !== myToken || committedInSessionRef.current) return;

            let finalChunk = "";
            let interimChunk = "";
            let hasExplicitFinal = false;
            let hasUndefinedFinal = false;

            for (let i = 0; i < event.results.length; i += 1) {
              const item = event.results[i];
              if (!item || item.length === 0) continue;

              let chosen = item[0]?.transcript ?? "";
              for (let a = 0; a < item.length; a += 1) {
                const alt = item[a]?.transcript ?? "";
                if (isDontKnowAnswer(alt)) {
                  chosen = alt;
                  break;
                }
              }

              if (item.isFinal === undefined) {
                hasUndefinedFinal = true;
                finalChunk += ` ${chosen}`;
              } else if (item.isFinal) {
                hasExplicitFinal = true;
                finalChunk += ` ${chosen}`;
              } else {
                interimChunk += ` ${chosen}`;
              }
            }

            const combined = `${finalChunk} ${interimChunk}`.replace(/\s+/g, " ").trim();
            if (!combined) return;

            interimRef.current = combined;
            setLiveTranscript(combined);

            if (silenceTimerRef.current !== null) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            if (hasUndefinedFinal && !interimChunk.trim()) {
              commitText(combined);
              return;
            }

            if (isDontKnowAnswer(combined)) {
              silenceTimerRef.current = window.setTimeout(() => {
                if (interimRef.current.trim()) commitText(interimRef.current);
              }, 260);
              return;
            }

            const incomplete = isIncompleteUtterance(combined);
            const waitMs = incomplete ? 1200 : hasExplicitFinal && !interimChunk.trim() ? 320 : 750;

            silenceTimerRef.current = window.setTimeout(() => {
              if (interimRef.current.trim()) {
                commitText(interimRef.current);
              }
            }, waitMs);
          };

          recognition.onerror = (event) => {
            if (activeRef.current !== recognition) return;
            activeRef.current = null;
            const err = event?.error ?? "";

            // Web Speech がエラーになった場合、getUserMedia が使えれば即座に VAD フォールバックへ引き継いでマイク ON を維持
            if (vadActiveRef.current || hasGetUserMedia) {
              startVadFallback();
              return;
            }

            if (err === "not-allowed" || err === "audio-capture") {
              userRequestedListenRef.current = false;
              setListeningBoth(false);
              setMicHint("マイクボタンを1回タップしてマイクをONにしてね！");
              return;
            }

            if (shouldKeepListening()) {
              restartTimerRef.current = window.setTimeout(() => {
                if (sessionTokenRef.current === myToken) startRecognition(targetLang);
              }, 200);
            } else {
              setListeningBoth(false);
            }
          };

          recognition.onend = () => {
            if (activeRef.current !== recognition) return;
            activeRef.current = null;

            if (!committedInSessionRef.current && interimRef.current.trim()) {
              commitText(interimRef.current);
              return;
            }

            // VAD ストリームが動いている間は Web Speech が切れてもマイク ON を維持
            if (vadActiveRef.current) return;

            if (shouldKeepListening()) {
              restartTimerRef.current = window.setTimeout(() => {
                if (sessionTokenRef.current === myToken) startRecognition(targetLang);
              }, 160);
            } else {
              setListeningBoth(false);
            }
          };

          recognition.start();
        } catch {
          activeRef.current = null;
          if (hasGetUserMedia) {
            startVadFallback();
          }
        }
      } else if (hasGetUserMedia) {
        // B) Web Speech API が存在しない環境では最初から VAD + /api/ai/stt を起動
        startVadFallback();
      }
    },
    [clearTimers, commitText, detachRecognition, setListeningBoth, shouldKeepListening, stopVadStream],
  );

  // キャラクターが話し終えたら自動でマイクON、話し始めたらマイクを一時停止
  useEffect(() => {
    const wantListen = autoListen || userRequestedListenRef.current;
    if (disabled || characterSpeaking || !wantListen || manualPauseRef.current) {
      stopRecognition();
      return;
    }
    if (listeningRef.current && (activeRef.current || vadActiveRef.current)) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (!activeRef.current && !vadActiveRef.current) {
        startRecognition();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [autoListen, characterSpeaking, disabled, startRecognition, stopRecognition]);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  const handleMicToggle = () => {
    if (disabled) return;

    // すでに何か話している途中でボタンを押した場合は、即座にその言葉を確定・送信する
    if (listeningRef.current && interimRef.current.trim()) {
      commitText(interimRef.current);
      return;
    }
    if (listeningRef.current && liveTranscript && finalizeVadRef.current) {
      void finalizeVadRef.current();
      return;
    }

    if (characterSpeaking) {
      propsRef.current.characterSpeaking = false;
      onInterruptSpeech?.();
      manualPauseRef.current = false;
      userRequestedListenRef.current = true;
      onAutoListenChange?.(true);
      startRecognition(undefined, true);
      return;
    }

    if (listeningRef.current) {
      // 起動直後(700ms以内)にタップされた場合はOFFにせずONを維持する
      if (Date.now() - startedAtRef.current < 700) {
        manualPauseRef.current = false;
        userRequestedListenRef.current = true;
        onAutoListenChange?.(true);
        return;
      }
      manualPauseRef.current = true;
      userRequestedListenRef.current = false;
      stopRecognition();
    } else {
      propsRef.current.characterSpeaking = false;
      onInterruptSpeech?.();
      manualPauseRef.current = false;
      userRequestedListenRef.current = true;
      onAutoListenChange?.(true);
      startRecognition(undefined, true);
    }
  };

  const handleLangSwitch = (nextLang: "en-US" | "ja-JP") => {
    if (disabled) return;
    setRecognitionLang(nextLang);
    propsRef.current.recognitionLang = nextLang;
    propsRef.current.characterSpeaking = false;
    manualPauseRef.current = false;
    userRequestedListenRef.current = true;
    onAutoListenChange?.(true);
    if (characterSpeaking) onInterruptSpeech?.();
    startRecognition(nextLang, true);
  };

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
              <span>
                {liveTranscript
                  ? "話しおわったら自動で送信（タップですぐ送信）"
                  : "マイクON・そのまま声で話してね！"}
              </span>
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

      {micHint && <p className={styles.voiceGuideSub}>{micHint}</p>}
    </div>
  );
}
