"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import styles from "@/components/kanoha.module.css";
import { speakCoachVoice, stopCoachVoice } from "@/lib/audio/coachSpeech";

export function VoiceButton({ text }: { text: string }) {
  const [status, setStatus] = useState("よみあげる");
  const [isPlaying, setIsPlaying] = useState(false);

  async function handleSpeak() {
    if (isPlaying) {
      stopCoachVoice();
      setIsPlaying(false);
      setStatus("もういちど よむ");
      return;
    }

    try {
      setIsPlaying(true);
      setStatus("よんでいるよ♪");
      await speakCoachVoice(text, "happy");
    } finally {
      setIsPlaying(false);
      setStatus("もういちど よむ");
    }
  }

  return (
    <button
      className={styles.ghostButton}
      type="button"
      onClick={() => void handleSpeak()}
      aria-label="もんだいを かのはちゃんの声で よみあげる"
    >
      {isPlaying ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
      {status}
    </button>
  );
}
