"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { getEnglishTalkProgress, type SceneProgress } from "@/lib/englishTalk/progressStore";
import styles from "./englishTalk.module.css";

export function SceneProgressBadge({ sceneId, childId }: { sceneId: string; childId?: string }) {
  const [progress, setProgress] = useState<SceneProgress | null>(null);

  useEffect(() => {
    const sync = () => {
      const map = getEnglishTalkProgress(childId);
      setProgress(map[sceneId] ?? null);
    };
    sync();
    window.addEventListener("kanoha-english-talk-progress", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kanoha-english-talk-progress", sync);
      window.removeEventListener("storage", sync);
    };
  }, [childId, sceneId]);

  if (!progress) return null;

  return (
    <span className={styles.sceneProgressBadge} aria-label={`クリア ほし ${progress.stars}こ`}>
      <span className={styles.sceneStars} aria-hidden="true">
        {Array.from({ length: 3 }, (_, idx) => (
          <Star
            key={idx}
            size={15}
            fill={idx < progress.stars ? "#ffc83d" : "none"}
            color="#f0a500"
          />
        ))}
      </span>
      <span>クリア！</span>
    </span>
  );
}
