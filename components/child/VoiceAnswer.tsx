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

type SpeechWindow = typeof window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const findRecognition = (): SpeechRecognitionConstructor | undefined => {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
};

/** この端末で音声認識が使えるか(サーバー描画と最初の描画では false)。 */
export function useSpeechRecognitionSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(Boolean(findRecognition())), []);
  return supported;
}

export function VoiceAnswer({
  onAnswer,
  lang = "ja-JP",
  disabled = false,
  idleLabel = "こえで こたえる",
  heardLabel = "きこえたよ",
  className = styles.secondaryButton,
}: {
  onAnswer: (answer: string) => void;
  /** 答え合わせ中など、声のこたえを受け付けないとき */
  disabled?: boolean;
  /** 認識する言語(英語の問題では en-US) */
  lang?: "ja-JP" | "en-US";
  /** 押す前のボタンの文言 */
  idleLabel?: string;
  /** 聞き取れたあとのボタンの文言 */
  heardLabel?: string;
  className?: string;
}) {
  const [label, setLabel] = useState(idleLabel);
  const supported = useSpeechRecognitionSupported();
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

  function listen() {
    const Recognition = findRecognition();
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
      setLabel(heardLabel);
    };
    recognition.onerror = () => setLabel("もういちど はなしてね");
    recognition.start();
    setLabel("きいているよ");
  }

  if (!supported) return null;

  return (
    <button className={className} type="button" onClick={listen} disabled={disabled}>
      <Mic size={20} aria-hidden="true" />
      {label}
    </button>
  );
}
