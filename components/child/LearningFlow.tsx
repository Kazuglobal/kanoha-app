"use client";

import { useEffect, useState } from "react";
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
import { FLOW_TEXT, PRACTICE_TEXT } from "./childStrings";
import { FinishedScreen, LimitScreen, PracticeFlow } from "./PracticeFlow";
import { matchChoiceFromSpeech } from "@/lib/utils/answers";
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

  if (flow.dailyLimit) return <LimitScreen usedMinutes={flow.dailyLimit.usedMinutes} homeHref={flow.homeHref} />;
  if (flow.finished) {
    return (
      <FinishedScreen
        readingMode={preferences.readingMode}
        resultHref={flow.resultHref}
        nextProblemHref={flow.nextProblemHref}
        isLastInUnit={flow.isLastInUnit}
        homeHref={flow.homeHref}
        setClear={Boolean(persisted?.setProgress && !persisted.nextProblemId)}
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
            isEnglish={subject === "english"}
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
                <span className={styles.problemNumber}>
                  {persisted?.setProgress ? PRACTICE_TEXT.setBadge : FLOW_TEXT.recommendedLabel}
                </span>
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
      {flow.checked ? <AnswerFeedback correct={flow.checked.correct} /> : null}

      {flow.checked?.correct ? <SolvedNextStep flow={flow} persisted={persisted} /> : null}

      {/* 正解したら入力欄は畳み、「つぎの もんだいへ」に場所をゆずる(スマホで重ならないように) */}
      {solved ? null : choices ? (
        <ChoiceAnswers
          choices={choices}
          flow={flow}
          subject={subject}
          enableVoiceAnswer={enableVoiceAnswer}
        />
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

function AnswerFeedback({ correct }: { correct: boolean }) {
  return (
    <div className={correct ? styles.feedback : styles.feedbackWrong} role="status">
      {correct ? (
        <span className={styles.feedbackStrong}>🎉 {FLOW_TEXT.correctFeedback}</span>
      ) : (
        <div>
          <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{FLOW_TEXT.wrongFeedback}</p>
          <p style={{ fontSize: "0.95rem", opacity: 0.9 }}>
            💡 まよったら、うえの「ヒント」を ひらいてみてね！
          </p>
        </div>
      )}
    </div>
  );
}

/** 正解したあとの つぎの一歩: セットの最後ならホームへ、ステージの最後ならステージマップへ、ふつうは つぎの もんだいへ。 */
function SolvedNextStep({ flow, persisted }: { flow: Flow; persisted?: PersistedProblem }) {
  // 「あたらしい もんだい」のセットの最後の問題(つぎの問題が無い)
  if (persisted?.setProgress && !persisted.nextProblemId) {
    return <ClearNotice title={PRACTICE_TEXT.setClearTitle} lead={PRACTICE_TEXT.setClearLead} homeLabel={PRACTICE_TEXT.backHome} homeHref={flow.homeHref} />;
  }
  if (flow.isLastInUnit) {
    return (
      <ClearNotice
        title="🎉 このステージ クリア！"
        lead="よくがんばったね！ひとやすみしよう。"
        homeLabel="🏠 ステージマップへ もどる"
        homeHref={flow.homeHref}
        nextHref={flow.nextProblemHref}
      />
    );
  }
  return flow.nextProblemHref ? (
    <Link href={flow.nextProblemHref as Route} className={styles.nextProblemButton}>
      🚀 つぎの もんだいへ すすむ！
    </Link>
  ) : null;
}

function ClearNotice({ title, lead, homeLabel, homeHref, nextHref }: { title: string; lead: string; homeLabel: string; homeHref: string; nextHref?: string | null }) {
  return (
    <div className={styles.stageClearNotice}>
      <p className={styles.stageClearTitle}>{title}</p>
      <p className={styles.stageClearLead}>{lead}</p>
      <div className={styles.stageClearButtons}>
        <Link href={homeHref as Route} className={styles.primaryButton}>
          {homeLabel}
        </Link>
        {nextHref ? (
          <Link href={nextHref as Route} className={styles.secondaryButton}>
            つぎの ステージへ 🚀
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** 選択式(英語など): タップまたは音声でそのまま答え合わせする。英語は音声を再生する。 */
function ChoiceAnswers({
  choices,
  flow,
  subject,
  enableVoiceAnswer = true,
}: {
  choices: readonly string[];
  flow: Flow;
  subject: Subject;
  enableVoiceAnswer?: boolean;
}) {
  // 英語の声は教科で決める(算数の「32mm」のような単位の英字を、英語の声で読まない)
  const isEnglish = subject === "english";
  // 聞き取る言語は、選択肢が英字のときだけ英語(「いぬ」「ねこ」から えらぶ英語の問題は 日本語で聞き取る)
  const speechLang = isEnglish && choices.some((c) => /[a-zA-Z]/.test(c)) ? "en-US" : "ja-JP";
  const [voiceMiss, setVoiceMiss] = useState(false);

  const handleSelect = (choice: string, kind: "tap" | "voice") => {
    setVoiceMiss(false);
    if (isEnglish && /[a-zA-Z]/.test(choice)) {
      void speakEnglish(choice);
    }
    void flow.checkOriginalAnswer(choice, kind);
  };

  const handleVoiceAnswer = (spokenText: string) => {
    const matched = matchChoiceFromSpeech(spokenText, choices);
    // 選択肢に合わない声は まちがいとして送らない(聞きまちがいで「おしい」になり、レベルも下がってしまう)
    if (matched) handleSelect(matched, "voice");
    else setVoiceMiss(true);
  };

  return (
    <div className={styles.choiceAnswersWrap}>
      {enableVoiceAnswer && (
        <div className={styles.choiceVoiceRow} style={{ marginBottom: "0.75rem" }}>
          <VoiceAnswer
            disabled={flow.pending}
            lang={speechLang}
            onAnswer={handleVoiceAnswer}
            onSubmitAnswer={handleVoiceAnswer}
          />
          {voiceMiss ? <p role="status" style={{ margin: "0.5rem 0 0", fontWeight: 600 }}>{FLOW_TEXT.voiceTryAgain}</p> : null}
        </div>
      )}
      <div className={styles.choiceGrid} role="group" aria-label="こたえを えらぶ">
        {choices.map((choice) => (
          <ChoiceButton
            key={choice}
            choice={choice}
            selected={flow.answer === choice}
            disabled={flow.pending}
            english={isEnglish && /[a-zA-Z]/.test(choice)}
            onSelect={() => handleSelect(choice, "tap")}
          />
        ))}
      </div>
    </div>
  );
}

function ChoiceButton({ choice, selected, disabled, english, onSelect }: { choice: string; selected: boolean; disabled: boolean; english: boolean; onSelect: () => void }) {
  return (
    <button
      className={`${styles.choice} ${selected ? styles.choiceSelected : ""}`}
      disabled={disabled}
      lang={english ? "en" : undefined}
      type="button"
      onClick={onSelect}
    >
      <span>{choice}</span>
      {english ? <Volume2 size={16} aria-hidden="true" className={styles.choiceSpeakerIcon} /> : null}
    </button>
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
              onSubmitAnswer={(ans) => void flow.checkOriginalAnswer(ans, "voice")}
            />
          ) : null}
          {persisted ? (
            <HandwritingPad
              childId={persisted.childId}
              onAnswer={flow.setAnswer}
              onSubmitAnswer={(ans) => void flow.checkOriginalAnswer(ans, "handwriting")}
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
