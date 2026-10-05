import { GRADE_2_MATH_UNITS, type Grade2MathUnit } from "./grade2Math";
import { GRADE_2_JAPANESE_UNITS, type Grade2JapaneseUnit } from "./grade2Japanese";
import { GRADE_2_ENGLISH_UNITS, type Grade2EnglishUnit } from "./grade2English";

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
    units: GRADE_2_MATH_UNITS,
    defaultProblemId: "volume-1",
    demoLabel: "水のかさ(LとmL)",
    answerMode: "numeric",
    speechLang: "ja-JP",
    fallbackHints: { hint1: "え や すうじ を みてみよう。", hint2: "すこしずつ かんがえてみよう。" },
  },
  japanese: {
    ja: "国語",
    child: "こくご",
    emoji: "📖",
    units: GRADE_2_JAPANESE_UNITS,
    defaultProblemId: "kanji-1",
    demoLabel: "漢字の書き取り",
    answerMode: "text",
    speechLang: "ja-JP",
    fallbackHints: { hint1: "かん字の かたちを よく みてみよう。", hint2: "１もじずつ おもいだして みよう。" },
  },
  english: {
    ja: "英語",
    child: "えいご",
    emoji: "🔤",
    units: GRADE_2_ENGLISH_UNITS,
    defaultProblemId: "english-alphabet-1",
    demoLabel: "アルファベット",
    answerMode: "choice",
    speechLang: "en-US",
    fallbackHints: { hint1: "おとを もういちど きいてみよう。", hint2: "えを おもいうかべて みよう。" },
  },
});

/** 旧 API 互換: 表示名だけが欲しい呼び出し側向け。 */
export const SUBJECT_LABELS: Readonly<Record<Subject, { ja: string; child: string; emoji: string }>> =
  SUBJECT_CONFIG;

export const isSubject = (value: string): value is Subject =>
  SUBJECTS.includes(value as Subject);

export type Grade2Unit = Grade2MathUnit | Grade2JapaneseUnit | Grade2EnglishUnit;

export const GRADE_2_ALL_UNITS = [
  ...GRADE_2_MATH_UNITS,
  ...GRADE_2_JAPANESE_UNITS,
  ...GRADE_2_ENGLISH_UNITS,
] as const;

export function getUnitsBySubject(subject: Subject): readonly string[] {
  return SUBJECT_CONFIG[subject].units;
}

/** 単元名から教科を判定する(未知の単元は算数)。 */
export function detectSubjectFromUnit(unit: string): Subject {
  return SUBJECTS.find((subject) => SUBJECT_CONFIG[subject].units.includes(unit)) ?? "math";
}

/**
 * 保存済みの subject を優先し、無い・不正なら単元名から判定する。
 * 教科の判定はこの関数だけで行う(単元名の直書き判定を散らさない)。
 */
export function resolveSubject(subject?: string | null, unit?: string | null): Subject {
  if (subject && isSubject(subject)) return subject;
  return detectSubjectFromUnit(unit ?? "");
}
