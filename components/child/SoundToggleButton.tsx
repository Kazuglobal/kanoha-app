"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX, Music } from "lucide-react";
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
      className={styles.ghostButton}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        fontWeight: 700,
        padding: "6px 12px",
        borderRadius: "99px",
        background: isMuted ? "#f3f4f6" : "#f0fdf4",
        color: isMuted ? "#6b7280" : "#15803d",
        border: `1px solid ${isMuted ? "#e5e7eb" : "#bbf7d0"}`,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      title={isMuted ? "おとを ならす" : "おとを けす"}
      aria-label={isMuted ? "おとを ならす" : "おとを けす"}
    >
      {isMuted ? (
        <>
          <VolumeX size={16} />
          <span>おと：OFF</span>
        </>
      ) : (
        <>
          <Music size={16} />
          <span>おと：ON</span>
        </>
      )}
    </button>
  );
}
