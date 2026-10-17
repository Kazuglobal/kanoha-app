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
  const [supported, setSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micHint, setMicHint] = useState<string | null>(null);
  const [recognitionLang, setRecognitionLang] = useState<"en-US" | "ja-JP">("en-US");

  const activeRef = useRef<InstanceType<RealtimeSpeechRecognitionConstructor> | null>(null);
  const activeLangRef = useRef<"en-US" | "ja-JP">("en-US");
  const interimRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const manualPauseRef = useRef(false);
  const userRequestedListenRef = useRef(false);
  const committedInSessionRef = useRef(false);
  const startedAtRef = useRef(0);
  const webSpeechFailedRef = useRef(false);

  // Web Audio VAD + MediaRecorder フォールバック用
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const vadActiveRef = useRef(false);

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

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  useEffect(() => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: RealtimeSpeechRecognitionConstructor;
      webkitSpeechRecognition?: RealtimeSpeechRecognitionConstructor;
    };
    const hasWebSpeech = Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
    const hasGetUserMedia = Boolean(
      typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function",
    );
    setSupported(hasWebSpeech || hasGetUserMedia);
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

  const stopVadStream = useCallback(() => {
    vadActiveRef.current = false;
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
    clearTimers();
    detachRecognition();
    stopVadStream();
    interimRef.current = "";
    setIsListening(false);
  }, [clearTimers, detachRecognition, stopVadStream]);

  const shouldKeepListening = useCallback(() => {
    const p = propsRef.current;
    if (p.disabled || p.characterSpeaking || manualPauseRef.current) return false;
    return p.autoListen || userRequestedListenRef.current;
  }, []);

  const commitText = useCallback(
    (rawText: string) => {
      const cleaned = stripSpeechFillers(rawText).trim();
      if (!cleaned) return;
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
   * ブラウザの Web Speech API が network / service-not-allowed 等で動かない環境向け:
   * getUserMedia + Web Audio API の音量検知(VAD)で発話区間を検出し、/api/ai/stt でテキスト化する。
   */
  const startVadFallback = useCallback(
    async (langOverride?: "en-US" | "ja-JP") => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setIsListening(false);
        setMicHint("下の入力欄にことばを入れて「はなす」をおしてね");
        return;
      }

      stopVadStream();
      const targetLang = langOverride ?? propsRef.current.recognitionLang;

      try {
        setIsListening(true);
        startedAtRef.current = Date.now();
        setMicHint(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (propsRef.current.disabled || propsRef.current.characterSpeaking || manualPauseRef.current) {
          for (const track of stream.getTracks()) track.stop();
          setIsListening(false);
          return;
        }

        mediaStreamRef.current = stream;
        vadActiveRef.current = true;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const audioCtx = AudioCtx ? new AudioCtx() : null;
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
        const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

        const finalizeVadUtterance = async () => {
          if (!vadActiveRef.current) return;
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

          if (audioCtx && audioCtx.state !== "closed") {
            void audioCtx.close().catch(() => undefined);
          }
          stopVadStream();

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

          const json = await res?.json().catch(() => null);
          if (json?.success && typeof json.transcript === "string" && json.transcript.trim()) {
            commitText(json.transcript.trim());
          } else {
            setLiveTranscript("");
            if (shouldKeepListening()) {
              restartTimerRef.current = window.setTimeout(() => {
                void startVadFallback(targetLang);
              }, 160);
            } else {
              setIsListening(false);
            }
          }
        };

        const checkVolume = () => {
          if (!vadActiveRef.current || !analyser || !dataArray) return;
          analyser.getByteTimeDomainData(dataArray);
          let sumSq = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            const centered = (dataArray[i] - 128) / 128;
            sumSq += centered * centered;
          }
          const rms = Math.sqrt(sumSq / dataArray.length);
          const now = Date.now();

          if (rms > 0.03) {
            if (spokeAt === 0) {
              spokeAt = now;
              setLiveTranscript("声をききとっています...");
            }
            lastVoiceAt = now;
          } else if (spokeAt > 0 && now - spokeAt >= 240 && now - lastVoiceAt >= 640) {
            void finalizeVadUtterance();
            return;
          }

          vadFrameRef.current = window.requestAnimationFrame(checkVolume);
        };

        if (analyser) {
          vadFrameRef.current = window.requestAnimationFrame(checkVolume);
        }
      } catch {
        setIsListening(false);
        setMicHint("マイクの許可をオンにするか、下の入力欄から送ってね");
      }
    },
    [commitText, shouldKeepListening, stopVadStream],
  );

  const startRecognition = useCallback(
    (langOverride?: "en-US" | "ja-JP", directFromGesture = false) => {
      const targetLang = langOverride ?? propsRef.current.recognitionLang;

      if (webSpeechFailedRef.current) {
        void startVadFallback(targetLang);
        return;
      }

      const speechWindow = window as typeof window & {
        SpeechRecognition?: RealtimeSpeechRecognitionConstructor;
        webkitSpeechRecognition?: RealtimeSpeechRecognitionConstructor;
      };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) {
        webSpeechFailedRef.current = true;
        void startVadFallback(targetLang);
        return;
      }

      // すでに同じ言語で聞き取り中なら再生成して abort させない
      if (!directFromGesture && activeRef.current && activeLangRef.current === targetLang) {
        setIsListening(true);
        return;
      }

      const hadActive = Boolean(activeRef.current);
      clearTimers();
      detachRecognition();
      committedInSessionRef.current = false;
      activeLangRef.current = targetLang;
      setIsListening(true);
      startedAtRef.current = Date.now();
      setMicHint(null);

      const launch = () => {
        if (!directFromGesture && (propsRef.current.disabled || propsRef.current.characterSpeaking || manualPauseRef.current)) {
          setIsListening(false);
          return;
        }
        try {
          const recognition = new Recognition();
          activeRef.current = recognition;
          recognition.lang = targetLang;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 5;

          recognition.onresult = (event) => {
            if (activeRef.current !== recognition) return;

            let finalChunk = "";
            let interimChunk = "";
            let hasExplicitFinal = false;
            let hasUndefinedFinal = false;

            // 先頭(0)からすべての認識セグメントを結合して、前半の単語が消えないようにする
            for (let i = 0; i < event.results.length; i += 1) {
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

            // テストモック等で isFinal が未定義の場合は即時確定する
            if (hasUndefinedFinal && !interimChunk.trim()) {
              commitText(combined);
              return;
            }

            // 「I don't know / わからない」は素早く反応する
            if (isDontKnowAnswer(combined)) {
              silenceTimerRef.current = window.setTimeout(() => {
                if (interimRef.current.trim()) commitText(interimRef.current);
              }, 260);
              return;
            }

            // 「Hello」「My name is」など文の途中のプレフィックスなら、続きの単語（名前など）を待つ
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
            const err = event?.error ?? "";
            activeRef.current = null;

            // Chrome の Web Speech API がネットワーク制限やサービス未対応で失敗する場合は VAD フォールバックへ切り替え
            if (err === "network" || err === "service-not-allowed" || err === "language-not-supported") {
              webSpeechFailedRef.current = true;
              if (shouldKeepListening()) {
                void startVadFallback(targetLang);
              } else {
                setIsListening(false);
              }
              return;
            }

            if (err === "not-allowed" || err === "audio-capture") {
              // 自動開始がブラウザ制限でブロックされた場合は、ボタンを「タップでマイクON」に戻してユーザータップを待つ
              userRequestedListenRef.current = false;
              setIsListening(false);
              setMicHint("マイクボタンを1回タップしてマイクをONにしてね！");
              return;
            }

            // no-speech や一時的な aborted の場合は、聞き取りモードを維持したままシームレスに再開する
            if (shouldKeepListening()) {
              restartTimerRef.current = window.setTimeout(() => {
                startRecognition(targetLang);
              }, 160);
            } else {
              setIsListening(false);
            }
          };

          recognition.onend = () => {
            if (activeRef.current !== recognition) return;
            activeRef.current = null;

            // もし interim に話した内容が残っていたら捨てずに確定させる
            if (!committedInSessionRef.current && interimRef.current.trim()) {
              const leftover = interimRef.current;
              commitText(leftover);
              return;
            }

            // まだ自分の番なら、ボタン表示をガタつかせず自動で聞き取りを継続する
            if (shouldKeepListening()) {
              restartTimerRef.current = window.setTimeout(() => {
                startRecognition(targetLang);
              }, 140);
            } else {
              setIsListening(false);
            }
          };

          recognition.start();
          setIsListening(true);
        } catch {
          activeRef.current = null;
          webSpeechFailedRef.current = true;
          if (shouldKeepListening()) {
            void startVadFallback(targetLang);
          } else {
            setIsListening(false);
          }
        }
      };

      // ユーザータップによる明示的な起動時は、ブラウザのユーザージェスチャー権限を失わないよう同期的に start() する
      if (hadActive && !directFromGesture) {
        restartTimerRef.current = window.setTimeout(launch, 45);
      } else {
        launch();
      }
    },
    [clearTimers, commitText, detachRecognition, shouldKeepListening, startVadFallback],
  );

  // キャラクターが話し終えたら自動でマイクON、話し始めたらマイクを一時停止
  useEffect(() => {
    if (!supported) return;
    const wantListen = autoListen || userRequestedListenRef.current;
    if (disabled || characterSpeaking || !wantListen || manualPauseRef.current) {
      stopRecognition();
      return;
    }
    const timer = window.setTimeout(() => {
      if (!activeRef.current && !vadActiveRef.current) {
        startRecognition();
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [autoListen, characterSpeaking, disabled, startRecognition, stopRecognition, supported]);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  const handleMicToggle = () => {
    // すでに何か話している途中でボタンを押した場合は、即座にその言葉を確定・送信する
    if (isListening && interimRef.current.trim()) {
      commitText(interimRef.current);
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

    const actuallyActive = Boolean(activeRef.current || vadActiveRef.current);

    if (isListening && actuallyActive) {
      // 自動開始の直後(650ms以内)に「タップでマイクON」を見て押した場合は、OFFにせずONを維持する
      if (Date.now() - startedAtRef.current < 650) {
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
    setRecognitionLang(nextLang);
    propsRef.current.recognitionLang = nextLang;
    propsRef.current.characterSpeaking = false;
    manualPauseRef.current = false;
    userRequestedListenRef.current = true;
    onAutoListenChange?.(true);
    if (characterSpeaking) onInterruptSpeech?.();
    startRecognition(nextLang, true);
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
