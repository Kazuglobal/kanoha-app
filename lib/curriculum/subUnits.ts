import { GRADE_2_ENGLISH_CURRICULUM } from "./grade2English";
import { GRADE_2_JAPANESE_CURRICULUM } from "./grade2Japanese";
import { GRADE_2_MATH_CURRICULUM } from "./grade2Math";
import type { Subject } from "./subjects";

export interface UnitEntry {
  readonly unit: string;
  readonly subUnits: readonly string[];
}

/** 教科ごとの 単元 → 小単元 の一覧(定数リストの正本は grade2{Math,Japanese,English}.ts)。 */
export const UNIT_ENTRIES: Readonly<Record<Subject, readonly UnitEntry[]>> = Object.freeze({
  math: GRADE_2_MATH_CURRICULUM,
  japanese: GRADE_2_JAPANESE_CURRICULUM,
  english: GRADE_2_ENGLISH_CURRICULUM,
});

/** 単元名から小単元の一覧を返す(知らない単元は空)。 */
export const subUnitsOf = (unit: string): readonly string[] =>
  Object.values(UNIT_ENTRIES)
    .flat()
    .find((entry) => entry.unit === unit)?.subUnits ?? [];
