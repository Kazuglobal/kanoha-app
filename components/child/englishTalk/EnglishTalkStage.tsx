"use client";

import { Headphones, Languages, RotateCcw, Send, Star, Volume2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { REPEAT_TARGET, talkScore } from "@/lib/englishTalk/flow";
import type { PublicTalkScene } from "@/lib/englishTalk/judge";
import { speakTalkEnglish, stopTalkSpeech } from "@/lib/audio/englishTalkSpeech";
import { RealtimeTalkMic } from "./RealtimeTalkMic";
import { ThreeTalkStage3D } from "./ThreeTalkStage3D";
import { useEnglishTalk, type TalkTeach } from "./useEnglishTalk";
import styles from "./englishTalk.module.css";

/**
 * Three.js 3D 英会話ステージ:
 * - 各ステージ・各場面が繊細で可愛らしい 3D 空間として現れ、キャラクターと対面してやり取りをする
 * - 4択で選ぶのではなく、リアルタイムの「声」で直接お話しする
 * - 「I don't know」や「わからない」と言ったら日本語にして教えてくれる
 * - 間違っていたらすぐ英語で正しいフィードバックをしてくれる
 */
export function EnglishTalkStage({ scene, childId }: { scene: PublicTalkScene; childId?: string }) {
  const talk = useEnglishTalk(scene, childId);
  const { state, turn } = talk;
  const [isListening, setIsListening] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (talk.started) panelRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [talk.started, state.phase, talk.showJapanese]);

  const listHref = (childId ? `/child/english-talk?childId=${childId}` : "/child/english-talk") as Route;

  return (
    <div className={styles.stageWrap}>
      <section
        className={styles.scene}
        aria-label={`${scene.title}の3Dシーン`}
      >
        <ThreeTalkStage3D
          sceneId={scene.id}
          turnId={turn?.id}
          turnIndex={talk.turnIndex}
          totalTurns={talk.totalTurns}
          started={talk.started}
          mood={talk.mood}
          isListening={isListening}
          visual={turn?.visual}
          onCharacterTap={talk.started ? talk.sayPrompt : talk.begin}
        />

        <div className={styles.sceneHeaderRow}>
          <div className={styles.sceneTitle}>
            <span aria-hidden="true">{scene.emoji}</span> {scene.title}
            <small lang="en">{scene.titleEn}</small>
          </div>
          {talk.started && state.phase !== "done" && (
            <div className={styles.turnStepBadge}>
              場面 {talk.turnIndex + 1} / {talk.totalTurns}
            </div>
          )}
        </div>

        <div className={styles.sceneRight}>
          {talk.started && turn && state.phase !== "done" && (
            <SpeechBubble
              prompt={turn.prompt}
              promptJa={talk.showJapanese ? turn.promptJa : null}
              hintJa={talk.showJapanese ? turn.answerHintJa : null}
              feedbackEn={state.phase === "teach" && talk.teach ? talk.teach.feedbackEn : null}
              isRetry={state.isRetry}
              onListen={talk.sayPrompt}
            />
          )}
          {turn?.visual && talk.started && state.phase !== "done" && (
            <div className={styles.visual} aria-hidden="true" key={turn.id}>
              {turn.visual}
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel} aria-live="polite" ref={panelRef}>
        {!talk.started ? (
          <StartPanel description={scene.description} onStart={talk.begin} />
        ) : state.phase === "done" ? (
          <DonePanel score={talkScore(state)} onRestart={talk.restart} listHref={listHref} />
        ) : (
          <>
            <div className={styles.answerTools} style={{ justifyContent: "space-between", marginBottom: "0.25rem" }}>
              {talk.lastHeard ? (
                <span className={styles.heardBadge} data-testid="heard-utterance">
                  🗣️ あなたの声: 「{talk.lastHeard}」
                </span>
              ) : (
                <span className={styles.voiceGuideHint}>
                  🎤 リアルタイム音声対話中（「I don&apos;t know」「わからない」も声でOK）
                </span>
              )}
              <button
                className={styles.japaneseButton}
                type="button"
                style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                onClick={() => talk.setDirectVoiceMode(!talk.directVoiceMode)}
                aria-pressed={talk.directVoiceMode}
              >
                {talk.directVoiceMode ? "🎤 じどうマイク: ON" : "✋ じどうマイク: OFF"}
              </button>
            </div>

            {talk.message && (
              <p className={styles.message} data-testid="talk-feedback-message">
                {talk.message}
              </p>
            )}

            {state.phase === "ask" && turn && (
              <VoiceAnswerPanel
                hintJa={talk.showJapanese ? turn.answerHintJa : null}
                disabled={talk.checking}
                characterSpeaking={talk.speaking}
                autoStartVoice={talk.directVoiceMode}
                onListeningChange={setIsListening}
                onInterruptSpeech={stopTalkSpeech}
                onAnswer={(text) => void talk.answer(text, "voice")}
                onJapanese={talk.askInJapanese}
              />
            )}

            {state.phase === "teach" && talk.teach && (
              <TeachPanel
                teach={talk.teach}
                repeatCount={state.repeatCount}
                characterSpeaking={talk.speaking}
                autoStartVoice={talk.directVoiceMode}
                onListeningChange={setIsListening}
                onInterruptSpeech={stopTalkSpeech}
                onRepeat={(text) => void talk.repeat(text)}
              />
            )}

            {state.phase === "correct" && (
              <button className={styles.nextButton} type="button" onClick={talk.next}>
                つぎの場面へ ▶
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function SpeechBubble({
  prompt,
  promptJa,
  hintJa,
  feedbackEn,
  isRetry,
  onListen,
}: {
  prompt: string;
  promptJa: string | null;
  hintJa: string | null;
  feedbackEn: string | null;
  isRetry: boolean;
  onListen: () => void;
}) {
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
      <button className={styles.listenButton} type="button" onClick={onListen}>
        <Headphones size={20} aria-hidden="true" /> もういちど きく
      </button>
    </div>
  );
}

function StartPanel({ description, onStart }: { description: string; onStart: () => void }) {
  return (
    <div className={styles.startPanel}>
      <p className={styles.message}>{description}</p>
      <p className={styles.voiceGuideSub}>
        3Dのステージで かのはちゃんとお友だちに 声で話しかけよう！ 分からないときは「I don&apos;t know」や「わからない」と言ってね。
      </p>
      <button className={styles.nextButton} type="button" onClick={onStart}>
        おはなしを はじめる ▶
      </button>
    </div>
  );
}

function VoiceAnswerPanel({
  hintJa,
  disabled,
  characterSpeaking,
  autoStartVoice = true,
  onListeningChange,
  onInterruptSpeech,
  onAnswer,
  onJapanese,
}: {
  hintJa: string | null;
  disabled: boolean;
  characterSpeaking: boolean;
  autoStartVoice?: boolean;
  onListeningChange?: (listening: boolean) => void;
  onInterruptSpeech?: () => void;
  onAnswer: (text: string) => void;
  onJapanese: () => void;
}) {
  const [spokenInput, setSpokenInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = spokenInput.trim();
    if (!trimmed || disabled) return;
    setSpokenInput("");
    onAnswer(trimmed);
  };

  return (
    <div className={styles.answerPanel}>
      <RealtimeTalkMic
        disabled={disabled}
        characterSpeaking={characterSpeaking}
        autoListen={autoStartVoice}
        onListeningChange={onListeningChange}
        onInterruptSpeech={onInterruptSpeech}
        onUtterance={(text) => onAnswer(text)}
      />

      <div className={styles.answerTools}>
        <button className={styles.japaneseButton} type="button" onClick={onJapanese} disabled={disabled}>
          <Languages size={20} aria-hidden="true" /> えいごが わからない（日本語にして）
        </button>
      </div>

      {hintJa && <p className={styles.bubbleHint}>💡 {hintJa}</p>}

      <form className={styles.voiceInputForm} onSubmit={handleSubmit}>
        <input
          type="text"
          className={styles.voiceTextInput}
          value={spokenInput}
          disabled={disabled}
          onChange={(e) => setSpokenInput(e.target.value)}
          placeholder="声で話すか、ここに英語や「I don't know」「わからない」を入力..."
          aria-label="声でつたえることば"
        />
        <button
          type="submit"
          className={styles.voiceSubmitButton}
          disabled={disabled || !spokenInput.trim()}
        >
          <Send size={18} aria-hidden="true" /> はなす
        </button>
      </form>
    </div>
  );
}

function TeachPanel({
  teach,
  repeatCount,
  characterSpeaking,
  autoStartVoice = true,
  onListeningChange,
  onInterruptSpeech,
  onRepeat,
}: {
  teach: TalkTeach;
  repeatCount: number;
  characterSpeaking: boolean;
  autoStartVoice?: boolean;
  onListeningChange?: (listening: boolean) => void;
  onInterruptSpeech?: () => void;
  onRepeat: (text: string | null) => void;
}) {
  const [repeatInput, setRepeatInput] = useState("");

  const handleRepeatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repeatInput.trim();
    if (!trimmed) return;
    setRepeatInput("");
    onRepeat(trimmed);
  };

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
        <button
          className={styles.listenButton}
          type="button"
          onClick={() => void speakTalkEnglish(teach.feedbackEn, "think")}
        >
          <Headphones size={20} aria-hidden="true" /> おてほんを きく
        </button>
        <span className={styles.repeatProgress}>
          まねして いおう {repeatCount} / {REPEAT_TARGET}
        </span>
      </div>

      <RealtimeTalkMic
        characterSpeaking={characterSpeaking}
        autoListen={autoStartVoice}
        onListeningChange={onListeningChange}
        onInterruptSpeech={onInterruptSpeech}
        onUtterance={(text) => onRepeat(text)}
      />

      <div className={styles.answerTools}>
        <button className={styles.saidButton} type="button" onClick={() => onRepeat(null)}>
          いえたよ！
        </button>
      </div>
      <form className={styles.voiceInputForm} onSubmit={handleRepeatSubmit}>
        <input
          type="text"
          className={styles.voiceTextInput}
          value={repeatInput}
          onChange={(e) => setRepeatInput(e.target.value)}
          placeholder={`「${teach.modelAnswer}」と声に出すか入力...`}
          aria-label="まねして言うことば"
        />
        <button type="submit" className={styles.voiceSubmitButton} disabled={!repeatInput.trim()}>
          <Send size={18} aria-hidden="true" /> まねして言う
        </button>
      </form>
    </div>
  );
}

function DonePanel({
  score,
  onRestart,
  listHref,
}: {
  score: { firstTry: number; total: number };
  onRestart: () => void;
  listHref: Route;
}) {
  const stars = score.firstTry === score.total ? 3 : score.firstTry * 2 >= score.total ? 2 : 1;
  return (
    <div className={styles.donePanel}>
      <p className={styles.doneTitle}>おはなし できたね！</p>
      <div className={styles.stars} aria-label={`ほし ${stars}こ`}>
        {Array.from({ length: 3 }, (_, index) => (
          <Star key={index} size={40} fill={index < stars ? "#ffc83d" : "none"} color="#f0a500" />
        ))}
      </div>
      <p className={styles.message}>
        さいしょで つたわった しつもん: {score.firstTry} / {score.total}
      </p>
      <div className={styles.answerTools}>
        <button className={styles.saidButton} type="button" onClick={onRestart}>
          <RotateCcw size={20} aria-hidden="true" /> もういちど
        </button>
        <Link className={styles.nextButton} href={listHref}>
          ほかの シーンへ ▶
        </Link>
      </div>
    </div>
  );
}
