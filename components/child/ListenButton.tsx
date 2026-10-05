"use client";

import { Headphones } from "lucide-react";
import { useState } from "react";
import styles from "@/components/kanoha.module.css";
import { speakCoachVoice } from "@/lib/audio/coachSpeech";

const ENGLISH_RATE = 0.8;

/** 英語の音を en-US で読み上げる。Web Speech API が無い端末では Gemini TTS にフォールバックする。 */
export async function speakEnglish(text: string): Promise<void> {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
    await speakCoachVoice(text, "happy");
    return;
  }
  synth.cancel();
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = ENGLISH_RATE;
    const englishVoice = synth.getVoices().find((voice) => voice.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

/** 「えいごを きく」ボタン(手動再生のみ。自動再生はしない)。 */
export function ListenButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);

  async function handleListen() {
    if (playing) return;
    setPlaying(true);
    try {
      await speakEnglish(text);
    } finally {
      setPlaying(false);
    }
  }

  return (
    <button
      className={styles.listenButton}
      type="button"
      onClick={() => void handleListen()}
      aria-label="えいごの おとを きく"
      aria-pressed={playing}
    >
      <Headphones size={22} aria-hidden="true" />
      {playing ? "きいてね♪" : "えいごを きく"}
    </button>
  );
}
