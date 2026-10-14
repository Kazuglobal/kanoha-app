"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { stripSpeechFillers } from "@/lib/utils/answers";

type SpeechRecognitionConstructor = new () => {
  lang: string;
  start: () => void;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (event?: { error?: string }) => void;
  onend?: () => void;
  abort?: () => void;
  stop?: () => void;
};

export function VoiceAnswer({
  onAnswer,
  onSubmitAnswer,
  lang = "ja-JP",
  disabled = false,
  autoStart = false,
}: {
  onAnswer: (answer: string) => void;
  /** 音声認識完了時に即時答え合わせを行うコールバック */
  onSubmitAnswer?: (answer: string) => void;
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

  // 画面から消えたら聞き取りを止め、あとから届いた結果で答えを送らない
  useEffect(
    () => () => {
      const active = activeRef.current;
      activeRef.current = null;
      active?.abort?.();
    },
    [],
  );

  useEffect(() => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    setSupported(Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (autoStart && supported && !disabled && !isListening && !activeRef.current) {
      const timer = setTimeout(() => {
        toggleListen();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, supported, disabled]);

  function toggleListen() {
    if (isListening && activeRef.current) {
      activeRef.current.abort?.();
      activeRef.current = null;
      setIsListening(false);
      setLabel("こえで こたえる");
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setLabel("てで こたえてね");
      return;
    }

    try {
      const recognition = new Recognition();
      activeRef.current = recognition;
      recognition.lang = lang;

      recognition.onresult = (event) => {
        if (activeRef.current !== recognition) return;
        activeRef.current = null;
        setIsListening(false);
        const raw = event.results[0]?.[0]?.transcript ?? "";
        const answer = stripSpeechFillers(raw);
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
      };

      recognition.onerror = () => {
        if (activeRef.current !== recognition) return;
        activeRef.current = null;
        setIsListening(false);
        setLabel("もういちど はなしてね");
        setTimeout(() => {
          setLabel("こえで こたえる");
        }, 1500);
      };

      recognition.onend = () => {
        if (activeRef.current === recognition) {
          activeRef.current = null;
          setIsListening(false);
          setLabel("こえで こたえる");
        }
      };

      recognition.start();
      setIsListening(true);
      setLabel("きいているよ...はなしてね");
    } catch {
      activeRef.current = null;
      setIsListening(false);
      setLabel("もういちど おしてね");
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
