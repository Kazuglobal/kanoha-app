/**
 * 小学2年生向け「えいご」単元マスタ。
 * 外国語活動(3年〜)の前段として「聞く・えらぶ」で英語に親しむ内容に限定する(書かせない)。
 */
export const GRADE_2_ENGLISH_CURRICULUM = [
  {
    id: "alphabet",
    unit: "アルファベット",
    subUnits: ["大文字", "小文字", "大文字と小文字"],
    visualTemplate: null,
  },
  {
    id: "greetings",
    unit: "あいさつ",
    subUnits: ["朝と昼のあいさつ", "おれいとおわかれ", "名前をつたえる"],
    visualTemplate: null,
  },
  {
    id: "english-numbers",
    unit: "えいごのかず",
    subUnits: ["1から10", "11から20"],
    visualTemplate: null,
  },
  {
    id: "colors",
    unit: "いろ",
    subUnits: ["いろの名前"],
    visualTemplate: null,
  },
  {
    id: "animals",
    unit: "どうぶつ",
    subUnits: ["どうぶつの名前"],
    visualTemplate: null,
  },
  {
    id: "foods",
    unit: "たべもの",
    subUnits: ["くだもの", "たべもの"],
    visualTemplate: null,
  },
  {
    id: "body",
    unit: "からだ",
    subUnits: ["からだの名前"],
    visualTemplate: null,
  },
] as const;

export type Grade2EnglishCurriculumUnit = (typeof GRADE_2_ENGLISH_CURRICULUM)[number];
export type Grade2EnglishUnit = Grade2EnglishCurriculumUnit["unit"];

type UnitsOf<Entries extends readonly { unit: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { unit: infer Unit } ? Unit : never;
};
type Grade2EnglishUnitTuple = UnitsOf<typeof GRADE_2_ENGLISH_CURRICULUM>;

/** Canonical English unit names as a non-empty tuple so it can feed `z.enum`. */
export const GRADE_2_ENGLISH_UNITS = GRADE_2_ENGLISH_CURRICULUM.map(
  ({ unit }) => unit,
) as unknown as Grade2EnglishUnitTuple;

export const isGrade2EnglishUnit = (value: string): value is Grade2EnglishUnit =>
  GRADE_2_ENGLISH_UNITS.some((unit) => unit === value);
