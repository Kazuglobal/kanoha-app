import styles from "@/components/kanoha.module.css";

export function CharacterCoach({
  message,
  mood = "happy",
}: {
  message: string;
  mood?: "happy" | "think" | "celebrate";
}) {
  return (
    <aside className={styles.coach} aria-label={`かのはコーチ: ${message}`}>
      <p className={styles.speech}>{message}</p>
      <div className={styles.coachBody} data-mood={mood} aria-hidden="true">
        か
      </div>
    </aside>
  );
}

