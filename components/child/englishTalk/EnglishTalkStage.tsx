"use client";

import { Headphones, Languages, RotateCcw, Star } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { VoiceAnswer } from "@/components/child/VoiceAnswer";
import { REPEAT_TARGET, talkScore } from "@/lib/englishTalk/flow";
import type { PublicTalkScene } from "@/lib/englishTalk/judge";
import { speakTalkEnglish } from "@/lib/audio/englishTalkSpeech";
import { TalkCharacter } from "./TalkCharacter";
import { useEnglishTalk, type TalkTeach } from "./useEnglishTalk";
import styles from "./englishTalk.module.css";

/**
 * 英会話れんしゅうの舞台: 背景のシーンの中で、かのはちゃんが英語で話しかける。
 * こたえは「こえ(en-US)」か「4択」。まちがえたら正しい言い方を教えて、まねして2回いう。
 */
export function EnglishTalkStage({ scene, childId }: { scene: PublicTalkScene; childId?: string }) {
  const talk = useEnglishTalk(scene, childId);
  const { state, turn } = talk;
  const panelRef = useRef<HTMLElement>(null);
  // 小さい画面でも、こたえるボタンが画面の外に出たままにならないようにする
  useEffect(() => {
    if (talk.started) panelRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [talk.started, state.phase, talk.showJapanese]);
  const listHref = (childId ? `/child/english-talk?childId=${childId}` : "/child/english-talk") as Route;

  return (
    <div className={styles.stageWrap}>
      <section
        className={styles.scene}
        style={{ backgroundImage: `url(${scene.background})` }}
        aria-label={`${scene.title}のシーン`}
      >
        <div className={styles.sceneTitle}>
          <span aria-hidden="true">{scene.emoji}</span> {scene.title}
          <small lang="en">{scene.titleEn}</small>
        </div>
        <div className={styles.characterSpot}>
          <TalkCharacter mood={talk.mood} onTap={talk.started ? talk.sayPrompt : talk.begin} />
        </div>
        <div className={styles.sceneRight}>
          {talk.started && turn && state.phase !== "done" && (
            <SpeechBubble
              prompt={turn.prompt}
              promptJa={talk.showJapanese ? turn.promptJa : null}
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
            {talk.message && <p className={styles.message}>{talk.message}</p>}
            {state.phase === "ask" && turn && (
              <AnswerPanel
                choices={turn.choices}
                hintJa={talk.showJapanese ? turn.answerHintJa : null}
                disabled={talk.checking}
                onAnswer={(text, mode) => void talk.answer(text, mode)}
                onJapanese={talk.askInJapanese}
              />
            )}
            {state.phase === "teach" && talk.teach && (
              <TeachPanel
                teach={talk.teach}
                repeatCount={state.repeatCount}
                onRepeat={(text) => void talk.repeat(text)}
              />
            )}
            {state.phase === "correct" && (
              <button className={styles.nextButton} type="button" onClick={talk.next}>
                つぎへ ▶
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
  isRetry,
  onListen,
}: {
  prompt: string;
  promptJa: string | null;
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
      <button className={styles.nextButton} type="button" onClick={onStart}>
        おはなしを はじめる ▶
      </button>
    </div>
  );
}

function AnswerPanel({
  choices,
  hintJa,
  disabled,
  onAnswer,
  onJapanese,
}: {
  choices: readonly string[];
  /** 「えいごが わからない」を押したときの、こたえかたのヒント */
  hintJa: string | null;
  disabled: boolean;
  onAnswer: (text: string, mode: "choice" | "voice") => void;
  onJapanese: () => void;
}) {
  return (
    <div className={styles.answerPanel}>
      <div className={styles.answerTools}>
        <VoiceAnswer lang="en-US" onAnswer={(text) => onAnswer(text, "voice")} />
        <button className={styles.japaneseButton} type="button" onClick={onJapanese}>
          <Languages size={20} aria-hidden="true" /> えいごが わからない
        </button>
      </div>
      {hintJa && <p className={styles.bubbleHint}>💡 {hintJa}</p>}
      <p className={styles.choiceLead}>えらんで こたえても いいよ</p>
      <div className={styles.choices}>
        {choices.map((choice) => (
          <button
            key={choice}
            className={styles.choice}
            type="button"
            lang="en"
            disabled={disabled}
            onClick={() => onAnswer(choice, "choice")}
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}

function TeachPanel({
  teach,
  repeatCount,
  onRepeat,
}: {
  teach: TalkTeach;
  repeatCount: number;
  onRepeat: (text: string | null) => void;
}) {
  return (
    <div className={styles.teachPanel}>
      <p className={styles.teachLabel}>ただしい いいかた</p>
      <p className={styles.teachAnswer} lang="en">
        {teach.modelAnswer}
      </p>
      <p className={styles.teachJapanese}>{teach.modelAnswerJa}</p>
      <div className={styles.answerTools}>
        <button
          className={styles.listenButton}
          type="button"
          onClick={() => void speakTalkEnglish(teach.modelAnswer, "think")}
        >
          <Headphones size={20} aria-hidden="true" /> おてほんを きく
        </button>
        <span className={styles.repeatProgress}>
          まねして いおう {repeatCount} / {REPEAT_TARGET}
        </span>
      </div>
      <div className={styles.answerTools}>
        <VoiceAnswer lang="en-US" onAnswer={(text) => onRepeat(text)} />
        <button className={styles.saidButton} type="button" onClick={() => onRepeat(null)}>
          いえたよ！
        </button>
      </div>
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
