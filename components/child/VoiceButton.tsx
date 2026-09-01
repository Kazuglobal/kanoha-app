"use client";

import { Volume2 } from "lucide-react";
import { useState } from "react";
import styles from "@/components/kanoha.module.css";

export function VoiceButton({ text }: { text: string }) {
  const [status, setStatus] = useState("よみあげる");

  function speak() {
    if (!("speechSynthesis" in window)) {
      setStatus("このたんまつでは つかえないよ");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.onend = () => setStatus("もういちど よむ");
    window.speechSynthesis.speak(utterance);
    setStatus("よんでいるよ");
  }

  return (
    <button className={styles.ghostButton} type="button" onClick={speak}>
      <Volume2 size={20} aria-hidden="true" />
      {status}
    </button>
  );
}

