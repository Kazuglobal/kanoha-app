"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import styles from "@/components/kanoha.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import { setCelebrationsDeferred } from "@/lib/rewards/celebrationGate";
import { SUBJECT_CONFIG, type Subject } from "@/lib/curriculum/subjects";
import { Volume2 } from "lucide-react";
import { CharacterCoach } from "./CharacterCoach";
import { HandwritingPad } from "./HandwritingPad";
import { HintStepper } from "./HintStepper";
import { ListenButton, speakEnglish } from "./ListenButton";
import { RubyAuto } from "./RubyText";
import { FLOW_TEXT } from "./childStrings";
import { FinishedScreen, LimitScreen, PracticeFlow } from "./PracticeFlow";
import { VoiceAnswer } from "./VoiceAnswer";
import { VoiceButton } from "./VoiceButton";
import {
  useLearningFlow,
  type LearningPreferences,
  type PersistedProblem,
} from "./useLearningFlow";

const SUBJECT_BADGE_CLASS: Readonly<Record<Subject, string>> = {
  math: styles.subjectBadgeMath,
  japanese: styles.subjectBadgeJapanese,
  english: styles.subjectBadgeEnglish,
};

const DEFAULT_PREFERENCES: LearningPreferences = {
  enableAudio: true,
  enableVoiceAnswer: true,
  readingMode: "kanji_with_ruby",
};

/**
 * 学習フローの画面(状態とAPIは useLearningFlow に集約)。
 * 元問題 → 段階式ヒント → 類題5問 → 結果、の順に切り替える。
 */
export function LearningFlow({
  persisted,
  preferences = DEFAULT_PREFERENCES,
}: {
  persisted?: PersistedProblem;
  preferences?: LearningPreferences;
}) {
  const flow = useLearningFlow(persisted);
  const subject = flow.subject;
  const subjectConfig = SUBJECT_CONFIG[subject];
  // 答えを考えたあと(正解 or 答えのヒントまで見た)に、れんしゅうへ すすめる
  const canPractice = Boolean(flow.checked?.correct) || flow.revealedHints.length >= 4;

  // 解いている途中はお祝いモーダルを待たせ、5問が終わったら出す
  useEffect(() => {
    setCelebrationsDeferred(!flow.finished);
    return () => setCelebrationsDeferred(false);
  }, [flow.finished]);

  // 教科に応じた BGM の自動開始 & 終了
  useEffect(() => {
    if (!preferences.enableAudio) return;
    if (flow.finished) {
      soundManager.startBgm("celebrate");
    } else {
      soundManager.startBgm(subject);
    }
    return () => {
      soundManager.stopBgm();
    };
  }, [flow.finished, subject, preferences.enableAudio]);

  if (flow.dailyLimit) return <LimitScreen usedMinutes={flow.dailyLimit.usedMinutes} />;
  if (flow.finished) {
    return (
      <FinishedScreen
        readingMode={preferences.readingMode}
        resultHref={flow.resultHref}
        nextProblemHref={flow.nextProblemHref}
        isLastInUnit={flow.isLastInUnit}
        score={flow.score}
        unit={flow.unit}
        onRestart={() => void flow.restartFlow()}
      />
    );
  }
  if (flow.practiceIndex !== null) {
    return (
      <div className={styles.learningGrid}>
        <div className={styles.learningCoachCol}>
          <CharacterCoach
            message="れんしゅうも いっしょに がんばろうっ♪"
            mood="happy"
          />
        </div>
        <div className={styles.learningCardCol}>
          <PracticeFlow
            practiceIndex={flow.practiceIndex}
            problems={flow.similarProblems}
            readingMode={preferences.readingMode}
            score={flow.score}
            onAnswer={persisted ? flow.answerSimilar : undefined}
            onComplete={(correct) => void flow.completeSimilar(correct)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.learningGrid}>
      <div className={styles.learningCoachCol}>
        <CharacterCoach
          message={
            flow.checked?.correct
              ? "やったぁ！だいせいかい！すごいねっ✨"
              : flow.checked
              ? "おしい！もういっかい かんがえてみよう！"
              : FLOW_TEXT.coachThink
          }
          mood={flow.checked?.correct ? "celebrate" : "think"}
        />
      </div>

      <div className={styles.learningCardCol}>
        <section className={styles.learningProblemCard}>
          <div className={styles.problemScroll}>
            <div className={styles.learningHeaderRow}>
              <div className={styles.badgeGroup}>
                <span className={`${styles.subjectBadge} ${SUBJECT_BADGE_CLASS[subject]}`}>
                  {subjectConfig.emoji} {subjectConfig.child}
                </span>
                <span className={styles.problemNumber}>{FLOW_TEXT.recommendedLabel}</span>
              </div>
              {preferences.enableAudio ? <VoiceButton text={flow.question} /> : null}
            </div>

            <h1 className={styles.compactProblemText}>
              <RubyAuto text={flow.question} readingMode={preferences.readingMode} excludeBrackets />
            </h1>
            {persisted?.listenText ? <ListenButton text={persisted.listenText} /> : null}

            <HintStepper
              revealed={flow.revealedHints}
              onRequestNext={flow.requestNextHint}
              readingMode={preferences.readingMode}
              onSimplify={persisted ? () => void flow.simplifyHints() : undefined}
              simplifying={flow.simplifying}
              onVisual={flow.visualAvailable ? () => void flow.showVisualHint() : undefined}
              visualPending={flow.visualPending}
              visualUrl={flow.visualUrl}
            />

            {canPractice ? (
              <div className={styles.hintActions}>
                <button
                  className={styles.secondaryButton}
                  disabled={flow.pending}
                  type="button"
                  onClick={() => void flow.startPractice()}
                >
                  {flow.pending ? FLOW_TEXT.preparing : FLOW_TEXT.practiceButton}
                </button>
              </div>
            ) : null}
            {flow.saveMessage ? <p className={styles.feedbackWrong}>{flow.saveMessage}</p> : null}
            {flow.retryAction ? (
              <button className={styles.secondaryButton} type="button" onClick={flow.retryAction}>
                {FLOW_TEXT.retry}
              </button>
            ) : null}
          </div>

          <AnswerDock
            flow={flow}
            subject={subject}
            persisted={persisted}
            enableVoiceAnswer={preferences.enableVoiceAnswer}
          />
        </section>
      </div>
    </div>
  );
}

type Flow = ReturnType<typeof useLearningFlow>;

/**
 * 回答エリア(結果・入力・キーパッド)。スマホでは画面下に固定され、
 * 問題文とヒントだけがその上でスクロールする(ページ全体は縦スクロールしない)。
 * 選択肢がある問題はタップで答え、算数はテンキー、国語は文字入力+手書きで答える。
 */
function AnswerDock({
  flow,
  subject,
  persisted,
  enableVoiceAnswer,
}: {
  flow: Flow;
  subject: Subject;
  persisted?: PersistedProblem;
  enableVoiceAnswer: boolean;
}) {
  const solved = Boolean(flow.checked?.correct);
  const choices = persisted?.choices;
  return (
    <div className={styles.answerDock}>
      {flow.checked ? (
        <div className={flow.checked.correct ? styles.feedback : styles.feedbackWrong} role="status">
          {flow.checked.correct ? (
            <span className={styles.feedbackStrong}>🎉 {FLOW_TEXT.correctFeedback}</span>
          ) : (
            FLOW_TEXT.wrongFeedback
          )}
        </div>
      ) : null}

      {flow.checked?.correct ? (
        flow.isLastInUnit ? (
          <div className={styles.stageClearNotice}>
            <p className={styles.stageClearTitle}>🎉 このステージ クリア！</p>
            <p className={styles.stageClearLead}>よくがんばったね！ひとやすみしよう。</p>
            <div className={styles.stageClearButtons}>
              <Link href="/child/home" className={styles.primaryButton}>
                🏠 ステージマップへ もどる
              </Link>
              {flow.nextProblemHref ? (
                <Link href={flow.nextProblemHref as Route} className={styles.secondaryButton}>
                  つぎの ステージへ 🚀
                </Link>
              ) : null}
            </div>
          </div>
        ) : flow.nextProblemHref ? (
          <Link href={flow.nextProblemHref as Route} className={styles.nextProblemButton}>
            🚀 つぎの もんだいへ すすむ！
          </Link>
        ) : null
      ) : null}

      {/* 正解したら入力欄は畳み、「つぎの もんだいへ」に場所をゆずる(スマホで重ならないように) */}
      {solved ? null : choices ? (
        <ChoiceAnswers choices={choices} flow={flow} subject={subject} />
      ) : (
        <TypedAnswer
          enableVoiceAnswer={enableVoiceAnswer}
          flow={flow}
          persisted={persisted}
          subject={subject}
        />
      )}
    </div>
  );
}

/** 選択式(英語など): タップした選択肢でそのまま答え合わせする。英語は音声を再生する。 */
function ChoiceAnswers({
  choices,
  flow,
  subject,
}: {
  choices: readonly string[];
  flow: Flow;
  subject: Subject;
}) {
  const isEnglish = subject === "english" || choices.some((c) => /[a-zA-Z]/.test(c));

  const handleSelect = (choice: string) => {
    if (/[a-zA-Z]/.test(choice)) {
      void speakEnglish(choice);
    }
    void flow.checkOriginalAnswer(choice);
  };

  return (
    <div className={styles.choiceGrid} role="group" aria-label="こたえを えらぶ">
      {choices.map((choice) => {
        const isEnglishWord = /[a-zA-Z]/.test(choice);
        return (
          <button
            className={`${styles.choice} ${flow.answer === choice ? styles.choiceSelected : ""}`}
            disabled={flow.pending}
            key={choice}
            lang={isEnglishWord ? "en" : undefined}
            type="button"
            onClick={() => handleSelect(choice)}
          >
            <span>{choice}</span>
            {isEnglishWord ? <Volume2 size={16} aria-hidden="true" className={styles.choiceSpeakerIcon} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function TypedAnswer({
  flow,
  subject,
  persisted,
  enableVoiceAnswer,
}: {
  flow: Flow;
  subject: Subject;
  persisted?: PersistedProblem;
  enableVoiceAnswer: boolean;
}) {
  const numeric = SUBJECT_CONFIG[subject].answerMode === "numeric";
  const hasTools = enableVoiceAnswer || Boolean(persisted);
  return (
    <>
      <div className={styles.learningInputRow}>
        <input
          aria-label="こたえ"
          className={styles.learningDisplayInput}
          // テンキーがあるときは端末のキーボードを出さない(画面のテンキーと重ならないように)
          inputMode={numeric ? "none" : "text"}
          placeholder={numeric ? "こたえ" : "ここに こたえを かいてね"}
          value={flow.answer}
          onChange={(event) => flow.setAnswer(event.target.value)}
        />
        <button
          className={styles.toyAnswerButton}
          disabled={!flow.answer || flow.pending}
          type="button"
          onClick={() => void flow.checkOriginalAnswer()}
        >
          {FLOW_TEXT.answerButton}
        </button>
      </div>

      {hasTools ? (
        <div className={styles.learningActionBtns}>
          {enableVoiceAnswer ? (
            <VoiceAnswer
              lang={SUBJECT_CONFIG[subject].speechLang}
              onAnswer={flow.setAnswer}
              onSubmitAnswer={(ans) => void flow.checkOriginalAnswer(ans)}
            />
          ) : null}
          {persisted ? (
            <HandwritingPad
              childId={persisted.childId}
              onAnswer={flow.setAnswer}
              onSubmitAnswer={(ans) => void flow.checkOriginalAnswer(ans)}
              problemId={persisted.problemId}
              subject={subject}
            />
          ) : null}
        </div>
      ) : null}

      {numeric ? <ToyKeypad flow={flow} /> : null}
    </>
  );
}

/** 算数用 オンスクリーン・トイテンキー (タップでカンタン入力) */
function ToyKeypad({ flow }: { flow: Flow }) {
  return (
    <div className={styles.toyKeypad} aria-label="数字キーパッド">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
        <button
          key={num}
          type="button"
          className={styles.keypadKey}
          onClick={() => flow.setAnswer((prev) => prev + num.toString())}
        >
          {num}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.keypadKey} ${styles.keypadKeyAction} ${styles.keypadBack}`}
        onClick={() => flow.setAnswer((prev) => prev.slice(0, -1))}
        aria-label="1もじ けす"
      >
        ⌫
      </button>
      <button
        type="button"
        className={`${styles.keypadKey} ${styles.keypadKeyAction} ${styles.keypadClear}`}
        onClick={() => flow.setAnswer("")}
        aria-label="ぜんぶ けす"
      >
        クリア
      </button>
    </div>
  );
}
