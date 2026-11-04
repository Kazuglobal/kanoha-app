"use client";

import { Headphones, Volume2 } from "lucide-react";
import { REPEAT_TARGET, SELF_REPORT_AFTER_MISSES } from "@/lib/englishTalk/flow";
import { RealtimeTalkMic } from "../RealtimeTalkMic";
import type { TalkTeach } from "../useEnglishTalk";
import styles from "../englishTalk.module.css";

interface TeachPanelProps {
  sceneId: string;
  turnId?: string;
  fruit: string | null;
  teach: TalkTeach;
  repeatCount: number;
  characterSpeaking: boolean;
  /** 親の設定で声のこたえがオンか。オフならマイクを出さない */
  micEnabled: boolean;
  /** マイクが使えないとわかったか。そのときは「いえたよ！」ボタンでも進められる */
  voiceFailed: boolean;
  /** まねして言うが続けて合わなかった回数。2回で「いえたよ！」でも進められる(行き止まりにしない) */
  repeatMisses: number;
  /** 変わるとマイクを入れなおす(まねして言うを1回言うたびに、もう一度聞き始める) */
  micKey: number;
  /** 音を切ってあるとき(親の設定)は「おてほんを きく」を出さない */
  audioEnabled: boolean;
  autoMic: boolean;
  onAutoMicChange?: (enabled: boolean) => void;
  onVoiceUnavailable: () => void;
  onListeningChange: (listening: boolean) => void;
  onInterruptSpeech: () => void;
  onListenModel: () => void;
  onRepeat: (text: string | null) => void;
}

/** まちがえたあと: 正しい言い方を見て、まねして言う。 */
export function TeachPanel({
  sceneId,
  turnId,
  fruit,
  teach,
  repeatCount,
  characterSpeaking,
  micEnabled,
  voiceFailed,
  repeatMisses,
  micKey,
  audioEnabled,
  autoMic,
  onAutoMicChange,
  onVoiceUnavailable,
  onListeningChange,
  onInterruptSpeech,
  onListenModel,
  onRepeat,
}: TeachPanelProps) {
  return (
    <div className={styles.teachPanel}>
      <div className={styles.englishFeedbackBox} lang="en">
        <Volume2 size={20} aria-hidden="true" />
        <span>{teach.feedbackEn}</span>
      </div>
      <p className={styles.teachLabel}>ただしい いいかた</p>
      <p className={styles.teachAnswer} lang="en">
        {teach.modelAnswer}
      </p>
      <p className={styles.teachJapanese}>{teach.modelAnswerJa}</p>
      <div className={styles.answerTools}>
        {audioEnabled && (
          <button className={styles.listenButton} type="button" onClick={onListenModel}>
            <Headphones size={20} aria-hidden="true" /> おてほんを きく
          </button>
        )}
        <span className={styles.repeatProgress}>
          まねして いおう {repeatCount} / {REPEAT_TARGET}
        </span>
      </div>

      {micEnabled && (
        <RealtimeTalkMic
          key={micKey}
          sceneId={sceneId}
          turnId={turnId}
          fruit={fruit}
          characterSpeaking={characterSpeaking}
          autoListen={autoMic}
          onAutoListenChange={onAutoMicChange}
          onUnavailable={onVoiceUnavailable}
          onListeningChange={onListeningChange}
          onInterruptSpeech={onInterruptSpeech}
          onUtterance={(text) => onRepeat(text)}
        />
      )}
      {(!micEnabled || voiceFailed || repeatMisses >= SELF_REPORT_AFTER_MISSES) && (
        <div className={styles.answerTools}>
          <button className={styles.saidButton} type="button" onClick={() => onRepeat(null)}>
            いえたよ！
          </button>
        </div>
      )}
    </div>
  );
}
