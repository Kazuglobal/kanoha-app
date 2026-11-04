"use client";

import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { talkScore, talkStarsOf } from "@/lib/englishTalk/flow";
import type { PublicTalkScene } from "@/lib/englishTalk/judge";
import { getSceneFriendName } from "@/lib/englishTalk/sceneThemes";
import type { TalkSettings } from "@/lib/englishTalk/talkSettings";
import { AnswerPanel } from "./panels/AnswerPanel";
import { DonePanel } from "./panels/DonePanel";
import { SpeechBubble } from "./panels/SpeechBubble";
import { StartPanel } from "./panels/StartPanel";
import { TeachPanel } from "./panels/TeachPanel";
import { ThreeTalkStage3D } from "./ThreeTalkStage3D";
import { useEnglishTalk } from "./useEnglishTalk";
import styles from "./englishTalk.module.css";

/**
 * Three.js 3D 英会話ステージ:
 * - 各場面が 3D 空間として現れ、キャラクターと対面してやり取りをする
 * - 4択で選ぶのではなく、声で直接お話しする(困ったときはヒントの選択肢・日本語も使える)
 * - 「I don't know」や「わからない」と言ったら日本語にして教えてくれる
 * - 間違っていたらすぐ英語で正しい言い方を教えてくれる
 * - 次の問いは「つぎへ」をタップしたときだけ読む
 */
export function EnglishTalkStage({
  scene,
  childId,
  settings,
}: {
  scene: PublicTalkScene;
  childId?: string;
  settings?: TalkSettings;
}) {
  const talk = useEnglishTalk(scene, childId, {
    enableAudio: settings?.enableAudio,
    enableVoiceAnswer: settings?.enableVoiceAnswer,
  });
  const { state, turn } = talk;
  const [isListening, setIsListening] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const friendName = getSceneFriendName(scene.id);
  const micEnabled = settings?.enableVoiceAnswer !== false;
  const buttonsOnly = !micEnabled || talk.voiceUnavailable;
  const onAutoMicChange = talk.listenMode === "auto" ? talk.setAutoMic : undefined;

  useEffect(() => {
    if (talk.started) panelRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [talk.started, state.phase, talk.showJapanese]);

  const listHref = (childId ? `/child/english-talk?childId=${childId}` : "/child/english-talk") as Route;
  const running = talk.started && state.phase !== "done";

  return (
    <div className={styles.stageWrap}>
      <section className={styles.scene} aria-label={`${scene.title}の 3Dシーン`}>
        <ThreeTalkStage3D
          sceneId={scene.id}
          turnId={turn?.id}
          turnIndex={talk.turnIndex}
          totalTurns={talk.totalTurns}
          started={talk.started}
          mood={talk.mood}
          isListening={isListening}
          visual={turn?.visual}
          fallbackBackground={scene.background}
          onCharacterTap={talk.started ? talk.sayPrompt : talk.begin}
        />

        <div className={styles.sceneHeaderRow}>
          <div className={styles.sceneTitleGroup}>
            <div className={styles.sceneTitle}>
              <span aria-hidden="true">{scene.emoji}</span> {scene.title}
              <small lang="en">{scene.titleEn}</small>
            </div>
            <span className={styles.friendNameBadge} data-testid="scene-friend-badge">
              🤝 おともだち: {friendName}
            </span>
          </div>
          {running && (
            <div className={styles.turnStepBadge}>
              ばめん {talk.turnIndex + 1} / {talk.totalTurns}
            </div>
          )}
        </div>

        <div className={styles.sceneRight}>
          {running && turn && (
            <SpeechBubble
              prompt={turn.prompt}
              promptJa={talk.showJapanese ? turn.promptJa : null}
              hintJa={talk.showJapanese ? turn.answerHintJa : null}
              feedbackEn={state.phase === "teach" && talk.teach ? talk.teach.feedbackEn : null}
              isRetry={state.isRetry}
              onListen={talk.audioEnabled ? talk.sayPrompt : undefined}
            />
          )}
          {turn?.visual && running && (
            <div className={styles.visual} aria-hidden="true" key={turn.id}>
              {turn.visual}
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel} ref={panelRef}>
        {!talk.started ? (
          <StartPanel
            description={scene.description}
            friendName={friendName}
            micEnabled={micEnabled}
            autoListen={talk.listenMode === "auto"}
            onStart={talk.begin}
          />
        ) : state.phase === "done" ? (
          <DonePanel
            stars={talkStarsOf(state)}
            score={talkScore(state)}
            taught={talk.taught}
            audioEnabled={talk.audioEnabled}
            onListen={(text) => void talk.speakEnglish(text)}
            onRestart={talk.restart}
            listHref={listHref}
          />
        ) : (
          <>
            <div className={styles.answerTools} style={{ justifyContent: "space-between", marginBottom: "0.25rem" }}>
              {talk.lastHeard ? (
                <span className={styles.heardBadge} data-testid="heard-utterance">
                  🗣️ あなたのこえ: 「{talk.lastHeard}」
                </span>
              ) : (
                <span className={styles.voiceGuideHint}>
                  {buttonsOnly
                    ? "👆 ボタンを えらんで こたえてね"
                    : talk.listenMode === "auto"
                      ? "🎤 こえで おはなしちゅう（「I don't know」「わからない」も こえでOK）"
                      : "🎤 マイクを おして はなしてね（「I don't know」「わからない」も こえでOK）"}
                </span>
              )}
              {!buttonsOnly && talk.listenMode === "auto" && (
                <button
                  className={styles.japaneseButton}
                  type="button"
                  style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                  onClick={() => talk.setAutoMic(!talk.autoMic)}
                  aria-pressed={talk.autoMic}
                >
                  {talk.autoMic ? "🎤 じどうマイク: ON" : "✋ じどうマイク: OFF"}
                </button>
              )}
            </div>

            {talk.message && (
              <p className={styles.message} role="status" data-testid="talk-feedback-message">
                {talk.message}
              </p>
            )}

            {state.phase === "ask" && turn && (
              <AnswerPanel
                key={turn.id}
                sceneId={scene.id}
                turnId={turn.id}
                fruit={talk.fruitId}
                choices={turn.choices}
                hintJa={talk.showJapanese ? turn.answerHintJa : null}
                disabled={talk.checking}
                characterSpeaking={talk.speaking}
                micEnabled={micEnabled}
                voiceFailed={talk.voiceUnavailable}
                autoMic={talk.autoMic}
                micKey={talk.micKey}
                onAutoMicChange={onAutoMicChange}
                onChoicesOpen={talk.noteHelp}
                onVoiceUnavailable={talk.markVoiceUnavailable}
                onListeningChange={setIsListening}
                onInterruptSpeech={talk.stopSpeech}
                onAnswer={(text, mode) => void talk.answer(text, mode)}
                onJapanese={talk.askInJapanese}
              />
            )}

            {state.phase === "teach" && talk.teach && (
              <TeachPanel
                sceneId={scene.id}
                turnId={turn?.id}
                fruit={talk.fruitId}
                teach={talk.teach}
                repeatCount={state.repeatCount}
                characterSpeaking={talk.speaking}
                micEnabled={micEnabled}
                voiceFailed={talk.voiceUnavailable}
                repeatMisses={talk.repeatMisses}
                micKey={talk.micKey}
                audioEnabled={talk.audioEnabled}
                autoMic={talk.autoMic}
                onAutoMicChange={onAutoMicChange}
                onVoiceUnavailable={talk.markVoiceUnavailable}
                onListeningChange={setIsListening}
                onInterruptSpeech={talk.stopSpeech}
                onListenModel={() => void talk.speakEnglish(talk.teach?.modelAnswer ?? "", "think")}
                onRepeat={(text) => void talk.repeat(text)}
              />
            )}

            {state.phase === "correct" && (
              <button className={styles.nextButton} type="button" onClick={talk.next}>
                {talk.isLastStep ? "おわる ▶" : "つぎへ ▶"}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
