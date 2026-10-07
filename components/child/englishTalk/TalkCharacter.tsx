"use client";

import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { useEffect, useState } from "react";
import { KanohaCharacter } from "@/components/child/KanohaCharacter";
import styles from "./englishTalk.module.css";

export type TalkMood = "happy" | "think" | "celebrate";

/** 口パク中は小さく弾み、正解でジャンプ、まちがいで首をかしげる。 */
const MOTION: Record<TalkMood | "speaking", TargetAndTransition> = {
  happy: {
    y: [0, -8, 0],
    rotate: 0,
    transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
  },
  speaking: {
    y: [0, -10, 0, -6, 0],
    scaleY: [1, 1.03, 0.98, 1.02, 1],
    rotate: [0, -2, 2, -1, 0],
    transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" },
  },
  celebrate: {
    y: [0, -70, 0, -30, 0],
    rotate: [0, -8, 8, 0, 0],
    transition: { duration: 1.1, ease: "easeOut" },
  },
  think: {
    y: 0,
    rotate: [0, -7, -5, -7],
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

function useCoachSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const start = () => setSpeaking(true);
    const end = () => setSpeaking(false);
    window.addEventListener("kanoha-coach-speaking-start", start);
    window.addEventListener("kanoha-coach-speaking-end", end);
    return () => {
      window.removeEventListener("kanoha-coach-speaking-start", start);
      window.removeEventListener("kanoha-coach-speaking-end", end);
    };
  }, []);
  return speaking;
}

/** シーンの中を歩いて登場し、話す・よろこぶ・かんがえるに合わせて動く かのはちゃん。 */
export function TalkCharacter({ mood, onTap }: { mood: TalkMood; onTap?: () => void }) {
  const speaking = useCoachSpeaking();
  const reducedMotion = useReducedMotion();
  const pose = speaking && mood !== "celebrate" ? "speaking" : mood;

  return (
    <motion.div
      className={styles.characterWalk}
      initial={reducedMotion ? false : { x: -260, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      data-testid="talk-character"
      data-pose={pose}
    >
      <motion.div
        key={pose}
        className={styles.characterBody}
        animate={reducedMotion ? undefined : MOTION[pose]}
      >
        <KanohaCharacter mood={mood} onClick={onTap} />
      </motion.div>
      {speaking && (
        <span className={styles.soundWaves} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
      <span className={styles.characterShadow} aria-hidden="true" />
    </motion.div>
  );
}
