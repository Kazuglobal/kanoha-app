"use client";

import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";

type SpeechRecognitionConstructor = new () => {
  lang: string;
  start: () => void;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
};

export function VoiceAnswer({
  onAnswer,
  lang = "ja-JP",
}: {
  onAnswer: (answer: string) => void;
  /** 認識する言語(英語の問題では en-US) */
  lang?: "ja-JP" | "en-US";
}) {
  const [label, setLabel] = useState("こえで こたえる");
  const [supported, setSupported] = useState(false);

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
    recognition.lang = lang;
    recognition.onresult = (event) => {
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
    <button className={styles.secondaryButton} type="button" onClick={listen}>
      <Mic size={20} aria-hidden="true" />
      {label}
    </button>
  );
}
