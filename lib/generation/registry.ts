import "server-only";
import type { Subject } from "@/lib/curriculum/subjects";
import type { Level } from "@/lib/learning/level";
import { ENGLISH_GENERATORS } from "./generators/english";
import { JAPANESE_GENERATORS } from "./generators/japanese";
import { ADDITION_GENERATORS } from "./generators/math/addition";
import { FRACTION_GENERATORS } from "./generators/math/fractions";
import { LENGTH_GENERATORS, VOLUME_GENERATORS } from "./generators/math/measures";
import { MULTIPLICATION_GENERATORS } from "./generators/math/multiplication";
import { NUMBER_GENERATORS } from "./generators/math/numbers";
import { SUBTRACTION_GENERATORS } from "./generators/math/subtraction";
import { TIME_GENERATORS } from "./generators/math/time";
import type { GenerateInput, GeneratedProblem, GeneratorEntry } from "./types";

/** 自動生成できる 単元 × 小単元 の一覧。ここにない小単元は、問題バンクの問題を使う。 */
export const GENERATORS: readonly GeneratorEntry[] = [
  ...ADDITION_GENERATORS,
  ...SUBTRACTION_GENERATORS,
  ...MULTIPLICATION_GENERATORS,
  ...LENGTH_GENERATORS,
  ...VOLUME_GENERATORS,
  ...TIME_GENERATORS,
  ...NUMBER_GENERATORS,
  ...FRACTION_GENERATORS,
  ...JAPANESE_GENERATORS,
  ...ENGLISH_GENERATORS,
];

export const findGenerator = (unit: string, subUnit: string): GeneratorEntry | undefined =>
  GENERATORS.find((entry) => entry.unit === unit && entry.subUnit === subUnit);

export const generatorsForSubject = (subject: Subject): readonly GeneratorEntry[] =>
  GENERATORS.filter((entry) => entry.subject === subject);

/** 小単元に生成器があるか。 */
export const hasGenerator = (unit: string, subUnit: string): boolean => findGenerator(unit, subUnit) !== undefined;

/** 問題をつくる。生成器がない小単元は RangeError(呼ぶ前に hasGenerator で確かめる)。 */
export function generateProblem(input: GenerateInput): GeneratedProblem {
  const entry = findGenerator(input.unit, input.subUnit);
  if (!entry) throw new RangeError(`no generator for ${input.unit} / ${input.subUnit}`);
  return entry.generate(input);
}

const REF_PATTERN = /^L([1-5])$/;

/** `単元/小単元/L<レベル>/<seed>` を GenerateInput に戻す(seed に「/」があってもよい)。読めなければ null。 */
export function parseRef(ref: string): GenerateInput | null {
  const [unit, subUnit, levelPart, ...seedParts] = ref.split("/");
  const level = REF_PATTERN.exec(levelPart ?? "")?.[1];
  const seed = seedParts.join("/");
  if (!unit || !subUnit || !level || !seed) return null;
  return { unit, subUnit, level: Number(level) as Level, seed };
}

/** 保存してある ref から、同じ問題をつくりなおす。読めない・生成器がないときは null。 */
export function generateFromRef(ref: string): GeneratedProblem | null {
  const input = parseRef(ref);
  return input && hasGenerator(input.unit, input.subUnit) ? generateProblem(input) : null;
}

