"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { stripSpeechFillers } from "@/lib/utils/answers";

type SpeechRecognitionConstructor = new () => {
  lang: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  start: () => void;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void;
  onerror: (event?: { error?: string }) => void;
  onend?: () => void;
  abort?: () => void;
  stop?: () => void;
};

export function VoiceAnswer({
  onAnswer,
  onSubmitAnswer,
  onListeningChange,
  lang = "ja-JP",
  disabled = false,
  autoStart = false,
}: {
  onAnswer: (answer: string) => void;
  /** 音声認識完了時に即時答え合わせを行うコールバック */
  onSubmitAnswer?: (answer: string) => void;
  /** 聞き取り状態が変わったときに通知するコールバック */
  onListeningChange?: (listening: boolean) => void;
  /** 答え合わせ中など、声のこたえを受け付けないとき */
  disabled?: boolean;
  /** 認識する言語(英語の問題では en-US) */
  lang?: "ja-JP" | "en-US";
  /** 自動的に聞き取りを開始するかどうか */
  autoStart?: boolean;
}) {
  const [label, setLabel] = useState("こえで こたえる");
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const activeRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const vadActiveRef = useRef(false);

  const stopMedia = () => {
    vadActiveRef.current = false;
    if (vadFrameRef.current !== null) {
      window.cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = null;
    }
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.ondataavailable = null;
        rec.onstop = null;
        rec.stop();
      } catch {
        // ignore
      }
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
    }
  };

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  // 画面から消えたら聞き取りを止め、あとから届いた結果で答えを送らない
  useEffect(
    () => () => {
      const active = activeRef.current;
      activeRef.current = null;
      active?.abort?.();
      stopMedia();
    },
    [],
  );

  useEffect(() => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const hasWebSpeech = Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
    const hasMedia = Boolean(
      typeof navigator !== "undefined" &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function",
    );
    setSupported(hasWebSpeech || hasMedia);
  }, []);

  useEffect(() => {
    if (autoStart && supported && !disabled && !isListening && !activeRef.current && !vadActiveRef.current) {
      const timer = setTimeout(() => {
        toggleListen();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, supported, disabled]);

  function deliverTranscript(raw: string) {
    const answer = stripSpeechFillers(raw).trim();
    if (answer) {
      onAnswer(answer);
      if (onSubmitAnswer) {
        onSubmitAnswer(answer);
      }
      setLabel(`きこえたよ「${answer}」`);
    } else {
      setLabel("もういちど はなしてね");
    }
    setTimeout(() => {
      setLabel("こえで こたえる");
    }, 2000);
  }

  async function startVadFallback() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setIsListening(false);
      setLabel("てで こたえてね");
      return;
    }
    stopMedia();
    try {
      setIsListening(true);
      setLabel("きいているよ...はなしてね");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
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
          recorderRef.current = recorder;
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
      const startedWaitAt = Date.now();
      const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

      const finishVad = async () => {
        if (!vadActiveRef.current) return;
        vadActiveRef.current = false;
        setLabel("ききとっています...");

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
        stopMedia();
        setIsListening(false);

        const res = await fetch("/api/ai/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: base64Audio, mimeType, lang }),
        }).catch(() => null);
        const json = await res?.json().catch(() => null);
        if (json?.success && typeof json.transcript === "string" && json.transcript.trim()) {
          deliverTranscript(json.transcript.trim());
        } else {
          setLabel("もういちど はなしてね");
          setTimeout(() => setLabel("こえで こたえる"), 1500);
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
          if (spokeAt === 0) spokeAt = now;
          lastVoiceAt = now;
        } else if (spokeAt > 0 && now - spokeAt >= 220 && now - lastVoiceAt >= 620) {
          void finishVad();
          return;
        } else if (spokeAt === 0 && now - startedWaitAt > 6000) {
          stopMedia();
          setIsListening(false);
          setLabel("こえで こたえる");
          return;
        }
        vadFrameRef.current = window.requestAnimationFrame(checkVolume);
      };

      if (analyser) {
        vadFrameRef.current = window.requestAnimationFrame(checkVolume);
      }
    } catch {
      stopMedia();
      setIsListening(false);
      setLabel("もういちど おしてね");
    }
  }

  function toggleListen() {
    if (isListening && (activeRef.current || vadActiveRef.current)) {
      activeRef.current?.abort?.();
      activeRef.current = null;
      stopMedia();
      setIsListening(false);
      setLabel("こえで こたえる");
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    const hasMedia = Boolean(
      typeof navigator !== "undefined" &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function",
    );

    if (!Recognition) {
      void startVadFallback();
      return;
    }

    let delivered = false;
    const finishOnce = (raw: string) => {
      if (delivered) return;
      delivered = true;
      activeRef.current?.abort?.();
      activeRef.current = null;
      stopMedia();
      setIsListening(false);
      deliverTranscript(raw);
    };

    try {
      const recognition = new Recognition();
      activeRef.current = recognition;
      recognition.lang = lang;

      recognition.onresult = (event) => {
        if (activeRef.current !== recognition) return;
        const raw = event.results[0]?.[0]?.transcript ?? "";
        finishOnce(raw);
      };

      recognition.onerror = () => {
        if (activeRef.current !== recognition) return;
        activeRef.current = null;
        if (hasMedia) {
          if (!vadActiveRef.current) void startVadFallback();
          return;
        }
        setIsListening(false);
        setLabel("もういちど はなしてね");
        setTimeout(() => {
          setLabel("こえで こたえる");
        }, 1500);
      };

      recognition.onend = () => {
        if (activeRef.current === recognition) {
          activeRef.current = null;
          if (vadActiveRef.current) return;
          setIsListening(false);
          setLabel("こえで こたえる");
        }
      };

      recognition.start();
      setIsListening(true);
      setLabel("きいているよ...はなしてね");
      if (hasMedia) {
        void startVadFallback();
      }
    } catch {
      activeRef.current = null;
      void startVadFallback();
    }
  }

  if (!supported) return null;

  return (
    <button
      className={`${styles.secondaryButton} ${isListening ? styles.listeningActive : ""}`}
      type="button"
      onClick={toggleListen}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isListening}
    >
      <Mic size={20} aria-hidden="true" />
      {label}
    </button>
  );
}
