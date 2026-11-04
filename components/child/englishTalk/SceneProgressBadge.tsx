"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { getEnglishTalkProgress, type SceneProgress } from "@/lib/englishTalk/progressStore";
import styles from "./englishTalk.module.css";

/**
 * 場面の★。ログイン中の子はサーバーの記録(serverStars)、この端末の記録とくらべて高いほうを出す
 * (サーバーへ送れていないぶんを失わない)。デモは端末の記録だけ。
 */
export function SceneProgressBadge({ sceneId, childId, serverStars }: { sceneId: string; childId?: string; serverStars?: 1 | 2 | 3 }) {
  const [local, setLocal] = useState<SceneProgress | null>(null);

  useEffect(() => {
    const sync = () => {
      const map = getEnglishTalkProgress(childId);
      setLocal(map[sceneId] ?? null);
    };
    sync();
    window.addEventListener("kanoha-english-talk-progress", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kanoha-english-talk-progress", sync);
      window.removeEventListener("storage", sync);
    };
  }, [childId, sceneId]);

  const stars = Math.max(local?.stars ?? 0, serverStars ?? 0);
  if (stars === 0) return null;

  return (
    <span className={styles.sceneProgressBadge} aria-label={`クリア ほし ${stars}こ`}>
      <span className={styles.sceneStars} aria-hidden="true">
        {Array.from({ length: 3 }, (_, idx) => (
          <Star
            key={idx}
            size={15}
            fill={idx < stars ? "#ffc83d" : "none"}
            color="#f0a500"
          />
        ))}
      </span>
      <span>クリア！</span>
    </span>
  );
}
