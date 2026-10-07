"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";

type SpeechRecognitionConstructor = new () => {
  lang: string;
  start: () => void;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  abort?: () => void;
};

export function VoiceAnswer({
  onAnswer,
  lang = "ja-JP",
  disabled = false,
}: {
  onAnswer: (answer: string) => void;
  /** 答え合わせ中など、声のこたえを受け付けないとき */
  disabled?: boolean;
  /** 認識する言語(英語の問題では en-US) */
  lang?: "ja-JP" | "en-US";
}) {
  const [label, setLabel] = useState("こえで こたえる");
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

  function listen() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setLabel("てで こたえてね");
      return;
    }
    const recognition = new Recognition();
    activeRef.current = recognition;
    recognition.lang = lang;
    recognition.onresult = (event) => {
      if (activeRef.current !== recognition) return;
      activeRef.current = null;
      const answer = event.results[0][0].transcript;
      onAnswer(answer);
      setLabel("きこえたよ");
    };
    recognition.onerror = () => setLabel("もういちど はなしてね");
    recognition.start();
    setLabel("きいているよ");
  }

  if (!supported) return null;

  return (
    <button className={styles.secondaryButton} type="button" onClick={listen} disabled={disabled}>
      <Mic size={20} aria-hidden="true" />
      {label}
    </button>
  );
}
