import { GRADE_2_MATH_UNITS, type Grade2MathUnit } from "./grade2Math";
import { GRADE_2_JAPANESE_UNITS, type Grade2JapaneseUnit } from "./grade2Japanese";

export const SUBJECTS = ["math", "japanese"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABELS: Record<Subject, { ja: string; child: string; emoji: string }> = {
  math: {
    ja: "算数",
    child: "さんすう",
    emoji: "🧮",
  },
  japanese: {
    ja: "国語",
    child: "こくご",
    emoji: "📖",
  },
};

export const isSubject = (value: string): value is Subject =>
  SUBJECTS.includes(value as Subject);

export type Grade2Unit = Grade2MathUnit | Grade2JapaneseUnit;

export const GRADE_2_ALL_UNITS = [
  ...GRADE_2_MATH_UNITS,
  ...GRADE_2_JAPANESE_UNITS,
] as const;

export function getUnitsBySubject(subject: Subject): readonly string[] {
  return subject === "japanese" ? GRADE_2_JAPANESE_UNITS : GRADE_2_MATH_UNITS;
}

export function detectSubjectFromUnit(unit: string): Subject {
  if (GRADE_2_JAPANESE_UNITS.some((u) => u === unit)) {
    return "japanese";
  }
  return "math";
}
