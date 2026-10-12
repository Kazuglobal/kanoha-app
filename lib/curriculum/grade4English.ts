/**
 * 小学4年生向け「えいご（外国語活動 Let's Try! 2 準拠）」単元マスタ。
 * 「聞く・えらぶ」を中心に、天気・曜日・時刻・教科・お買い物・道案内など4年生の外国語活動に親しむ。
 */
export const GRADE_4_ENGLISH_CURRICULUM = [
  {
    id: "greetings",
    unit: "あいさつと天気",
    subUnits: ["世界のあいさつと気分", "天気と遊びのさそい方"],
    visualTemplate: null,
  },
  {
    id: "days-and-schedule",
    unit: "曜日とすごし方",
    subUnits: ["月曜日から日曜日", "曜日のたずね方"],
    visualTemplate: null,
  },
  {
    id: "time-and-routine",
    unit: "時刻と一日の生活",
    subUnits: ["いま何時？", "毎日の生活の英語"],
    visualTemplate: null,
  },
  {
    id: "school-subjects",
    unit: "すきな教科とスポーツ",
    subUnits: ["学校の教科", "スポーツとできること"],
    visualTemplate: null,
  },
  {
    id: "alphabet",
    unit: "アルファベットとことば",
    subUnits: ["大文字と小文字", "身のまわりのことば"],
    visualTemplate: null,
  },
  {
    id: "shopping",
    unit: "ほしいものとお買い物",
    subUnits: ["野菜や果物のたずね方", "数のたずね方"],
    visualTemplate: null,
  },
  {
    id: "places-and-directions",
    unit: "学校の場所と道案内",
    subUnits: ["学校の部屋の名前", "道案内の英語"],
    visualTemplate: null,
  },
] as const;

export type Grade4EnglishCurriculumUnit = (typeof GRADE_4_ENGLISH_CURRICULUM)[number];
export type Grade4EnglishUnit = Grade4EnglishCurriculumUnit["unit"];

type UnitsOf<Entries extends readonly { unit: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { unit: infer Unit } ? Unit : never;
};
type Grade4EnglishUnitTuple = UnitsOf<typeof GRADE_4_ENGLISH_CURRICULUM>;

/** Canonical English unit names as a non-empty tuple so it can feed `z.enum`. */
export const GRADE_4_ENGLISH_UNITS = GRADE_4_ENGLISH_CURRICULUM.map(
  ({ unit }) => unit,
) as unknown as Grade4EnglishUnitTuple;

export const isGrade4EnglishUnit = (value: string): value is Grade4EnglishUnit =>
  GRADE_4_ENGLISH_UNITS.some((unit) => unit === value);
