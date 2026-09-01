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

export function VoiceAnswer({ onAnswer }: { onAnswer: (answer: string) => void }) {
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
      setLabel("すうじで こたえてね");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ja-JP";
    recognition.onresult = (event) => {
      const answer = event.results[0][0].transcript;
      onAnswer(answer);
      setLabel("きこえたよ");
    };
    recognition.onerror = () => setLabel("すうじで こたえてね");
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
