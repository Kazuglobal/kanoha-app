"use client";

import { useEffect, useState } from "react";
import { VolumeX, Music } from "lucide-react";
import { soundManager, type SoundSettings } from "@/lib/audio/soundSystem";
import styles from "@/components/kanoha.module.css";

export function SoundToggleButton() {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    if (typeof window !== "undefined") {
      return soundManager.getSettings();
    }
    return { bgmEnabled: true, seEnabled: true };
  });

  useEffect(() => {
    const handleSoundChange = (e: Event) => {
      const customEvent = e as CustomEvent<SoundSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };
    window.addEventListener("kanoha-sound-change", handleSoundChange);
    return () => {
      window.removeEventListener("kanoha-sound-change", handleSoundChange);
    };
  }, []);

  const toggleSound = () => {
    soundManager.playTap();
    // BGMとSEをまとめてトグル
    const nextBgm = soundManager.toggleBgm();
    if (nextBgm !== settings.seEnabled) {
      soundManager.toggleSe();
    }
  };

  const isMuted = !settings.bgmEnabled && !settings.seEnabled;

  return (
    <button
      type="button"
      onClick={toggleSound}
      className={`${styles.ghostButton} ${styles.soundToggle} ${
        isMuted ? styles.soundToggleOff : styles.soundToggleOn
      }`}
      title={isMuted ? "おとを ならす" : "おとを けす"}
      aria-label={isMuted ? "おとを ならす" : "おとを けす"}
      aria-pressed={!isMuted}
    >
      {isMuted ? (
        <>
          <VolumeX size={18} aria-hidden="true" />
          <span className={styles.soundToggleLabel}>おと：OFF</span>
        </>
      ) : (
        <>
          <Music size={18} aria-hidden="true" />
          <span className={styles.soundToggleLabel}>おと：ON</span>
        </>
      )}
    </button>
  );
}
