"use client";

import { HelpCircle, Languages } from "lucide-react";
import { useState } from "react";
import { RealtimeTalkMic } from "../RealtimeTalkMic";
import styles from "../englishTalk.module.css";

interface AnswerPanelProps {
  sceneId: string;
  turnId: string;
  /** おみせで選んだ くだもの(問いが変わっているとき。聞き取りの文脈) */
  fruit: string | null;
  choices: readonly string[];
  hintJa: string | null;
  disabled: boolean;
  characterSpeaking: boolean;
  /** 親の設定で声のこたえがオンか。オフならマイクを出さず、4択だけにする */
  micEnabled: boolean;
  /** マイクが使えないとわかったか。そのときはマイクは残したまま、4択をはじめから出す */
  voiceFailed: boolean;
  autoMic: boolean;
  /** 変わるとマイクを入れなおす(日本語だけ・聞き取れなかった・通信の失敗のあとに、もう一度聞き始める) */
  micKey: number;
  /** デモ(タップ式)では渡さない */
  onAutoMicChange?: (enabled: boolean) => void;
  /** 4択を開いたとき(答えが見えるので、ヘルプとして数える) */
  onChoicesOpen: () => void;
  onVoiceUnavailable: () => void;
  onListeningChange: (listening: boolean) => void;
  onInterruptSpeech: () => void;
  onAnswer: (text: string, mode: "voice" | "choice") => void;
  onJapanese: () => void;
}

/** 答える場面: 声(マイク)と、ヘルプ(日本語・4択)。文字を打ち込む欄はない(英語は書かせない)。 */
export function AnswerPanel({
  sceneId,
  turnId,
  fruit,
  choices,
  hintJa,
  disabled,
  characterSpeaking,
  micEnabled,
  voiceFailed,
  autoMic,
  micKey,
  onAutoMicChange,
  onChoicesOpen,
  onVoiceUnavailable,
  onListeningChange,
  onInterruptSpeech,
  onAnswer,
  onJapanese,
}: AnswerPanelProps) {
  const [showChoices, setShowChoices] = useState(false);
  const choicesForced = !micEnabled || voiceFailed;
  const choicesVisible = showChoices || choicesForced;

  return (
    <div className={styles.answerPanel}>
      {micEnabled && (
        <RealtimeTalkMic
          key={micKey}
          sceneId={sceneId}
          turnId={turnId}
          fruit={fruit}
          disabled={disabled}
          characterSpeaking={characterSpeaking}
          autoListen={autoMic}
          onAutoListenChange={onAutoMicChange}
          onUnavailable={onVoiceUnavailable}
          onListeningChange={onListeningChange}
          onInterruptSpeech={onInterruptSpeech}
          onUtterance={(text) => onAnswer(text, "voice")}
        />
      )}

      <div className={styles.answerTools}>
        <button className={styles.japaneseButton} type="button" onClick={onJapanese} disabled={disabled}>
          <Languages size={20} aria-hidden="true" /> えいごが わからない（にほんごに して）
        </button>
        {!choicesForced && (
          <button
            className={styles.listenButton}
            type="button"
            onClick={() => {
              if (!showChoices) onChoicesOpen();
              setShowChoices(!showChoices);
            }}
            disabled={disabled}
            aria-expanded={showChoices}
          >
            <HelpCircle size={20} aria-hidden="true" />{" "}
            {showChoices ? "こたえの ヒントを とじる" : "こたえの ヒント（えらんで こたえる）"}
          </button>
        )}
      </div>

      {hintJa && <p className={styles.bubbleHint}>💡 {hintJa}</p>}

      {choicesVisible && (
        <div className={styles.choices} role="group" aria-label="こたえの ヒント せんたくし">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className={styles.choice}
              disabled={disabled}
              lang="en"
              onClick={() => onAnswer(choice, "choice")}
            >
              {choice}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
