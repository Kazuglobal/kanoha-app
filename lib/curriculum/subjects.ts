import { GRADE_4_MATH_UNITS, type Grade4MathUnit } from "./grade4Math";
import { GRADE_4_JAPANESE_UNITS, type Grade4JapaneseUnit } from "./grade4Japanese";
import { GRADE_4_ENGLISH_UNITS, type Grade4EnglishUnit } from "./grade4English";

export const SUBJECTS = ["math", "japanese", "english"] as const;
export type Subject = (typeof SUBJECTS)[number];

/** 回答のしかた。numeric はテンキー、text は文字入力+手書き、choice は選択肢タップ。 */
export type AnswerMode = "numeric" | "text" | "choice";

export interface SubjectConfig {
  /** 親向けの表示名(漢字) */
  ja: string;
  /** 子ども向けの表示名(ひらがな) */
  child: string;
  emoji: string;
  units: readonly string[];
  /** 未ログイン時・おすすめが無いときに最初に開く問題(curriculumBank の id) */
  defaultProblemId: string;
  /** デモ問題の短い説明(子ども向け) */
  demoLabel: string;
  answerMode: AnswerMode;
  /** 音声入力・読み上げの主言語 */
  speechLang: "ja-JP" | "en-US";
  /** AI がヒントを作れなかったときの固定ヒント(否定しない文言) */
  fallbackHints: { hint1: string; hint2: string };
}

export const SUBJECT_CONFIG: Readonly<Record<Subject, SubjectConfig>> = Object.freeze({
  math: {
    ja: "算数",
    child: "さんすう",
    emoji: "🧮",
    units: GRADE_4_MATH_UNITS,
    defaultProblemId: "large-numbers-1",
    demoLabel: "大きい数のしくみ(億と兆)",
    answerMode: "numeric",
    speechLang: "ja-JP",
    fallbackHints: { hint1: "図や 数字の 関係を 見てみよう。", hint2: "順を追って 少しずつ 考えてみよう。" },
  },
  japanese: {
    ja: "国語",
    child: "こくご",
    emoji: "📖",
    units: GRADE_4_JAPANESE_UNITS,
    defaultProblemId: "kanji-1",
    demoLabel: "漢字の書き取り",
    answerMode: "text",
    speechLang: "ja-JP",
    fallbackHints: { hint1: "かん字の 形や 意味を よく 見てみよう。", hint2: "１文字ずつ 思い出して みよう。" },
  },
  english: {
    ja: "英語",
    child: "えいご",
    emoji: "🔤",
    units: GRADE_4_ENGLISH_UNITS,
    defaultProblemId: "english-alphabet-1",
    demoLabel: "アルファベットとことば",
    answerMode: "choice",
    speechLang: "en-US",
    fallbackHints: { hint1: "おとを もういちど きいてみよう。", hint2: "場面を おもいうかべて みよう。" },
  },
});

/** 旧 API 互換: 表示名だけが欲しい呼び出し側向け。 */
export const SUBJECT_LABELS: Readonly<Record<Subject, { ja: string; child: string; emoji: string }>> =
  SUBJECT_CONFIG;

export const isSubject = (value: string): value is Subject =>
  SUBJECTS.includes(value as Subject);

export type Grade4Unit = Grade4MathUnit | Grade4JapaneseUnit | Grade4EnglishUnit;
export type Grade2Unit = Grade4Unit;

export const GRADE_4_ALL_UNITS = [
  ...GRADE_4_MATH_UNITS,
  ...GRADE_4_JAPANESE_UNITS,
  ...GRADE_4_ENGLISH_UNITS,
] as const;

export const GRADE_2_ALL_UNITS = GRADE_4_ALL_UNITS;

export function getUnitsBySubject(subject: Subject): readonly string[] {
  return SUBJECT_CONFIG[subject].units;
}

/** 単元名から教科を判定する(未知の単元は算数)。 */
export function detectSubjectFromUnit(unit: string): Subject {
  const matched = SUBJECTS.find((subject) => SUBJECT_CONFIG[subject].units.includes(unit));
  if (matched) return matched;
  if (["いろ", "どうぶつ", "たべもの", "からだ", "あいさつ", "えいごのかず", "アルファベット"].includes(unit)) {
    return "english";
  }
  return "math";
}

/**
 * 保存済みの subject を優先し、無い・不正なら単元名から判定する。
 * 教科の判定はこの関数だけで行う(単元名の直書き判定を散らさない)。
 */
export function resolveSubject(subject?: string | null, unit?: string | null): Subject {
  if (subject && isSubject(subject)) return subject;
  return detectSubjectFromUnit(unit ?? "");
}
