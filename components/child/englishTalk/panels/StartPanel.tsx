import styles from "../englishTalk.module.css";

interface StartPanelProps {
  description: string;
  friendName: string;
  /** 親の設定で声のこたえがオンか。オフなら、マイクの話はせず、ボタンで答える案内にする */
  micEnabled: boolean;
  /** マイクを自動で入れるか(デモは、ボタンを押した1回だけ聞く) */
  autoListen: boolean;
  onStart: () => void;
}

export function StartPanel({ description, friendName, micEnabled, autoListen, onStart }: StartPanelProps) {
  return (
    <div className={styles.startPanel}>
      <p className={styles.message}>{description}</p>
      <p className={styles.voiceGuideSub}>
        {micEnabled
          ? `ステージで かのはちゃんと ${friendName}に こえで はなしかけよう！${autoListen ? "" : " マイクの ボタンを おして はなしてね。"} わからないときは「I don't know」や「わからない」と いってね。`
          : `ステージで かのはちゃんと ${friendName}と おはなししよう！ ボタンを えらんで こたえてね。`}
      </p>
      <button className={styles.nextButton} type="button" onClick={onStart}>
        おはなしを はじめる ▶
      </button>
    </div>
  );
}
