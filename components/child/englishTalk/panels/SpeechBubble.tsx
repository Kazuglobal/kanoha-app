import { Headphones } from "lucide-react";
import styles from "../englishTalk.module.css";

interface SpeechBubbleProps {
  prompt: string;
  promptJa: string | null;
  hintJa: string | null;
  feedbackEn: string | null;
  isRetry: boolean;
  /** 音が切ってあるとき(親の設定)は渡さない。「もういちど きく」を出さない */
  onListen?: () => void;
}

export function SpeechBubble({ prompt, promptJa, hintJa, feedbackEn, isRetry, onListen }: SpeechBubbleProps) {
  return (
    <div className={styles.bubble}>
      {isRetry && <span className={styles.retryBadge}>もういちど チャレンジ！</span>}
      <p className={styles.bubbleEnglish} lang="en">
        {prompt}
      </p>
      {promptJa && <p className={styles.bubbleJapanese}>{promptJa}</p>}
      {hintJa && <p className={styles.bubbleHint}>💡 {hintJa}</p>}
      {feedbackEn && (
        <p className={styles.bubbleFeedbackEn} lang="en" data-testid="english-feedback-bubble">
          💬 {feedbackEn}
        </p>
      )}
      {onListen && (
        <button className={styles.listenButton} type="button" onClick={onListen}>
          <Headphones size={20} aria-hidden="true" /> もういちど きく
        </button>
      )}
    </div>
  );
}
