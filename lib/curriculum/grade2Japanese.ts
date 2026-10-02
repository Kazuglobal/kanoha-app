export const GRADE_2_JAPANESE_CURRICULUM = [
  {
    id: "kanji",
    unit: "漢字",
    subUnits: ["漢字の読み", "漢字の書き", "部首と筆順", "同じ部分をもつ漢字"],
    visualTemplate: null,
  },
  {
    id: "vocabulary",
    unit: "ことばのきまり",
    subUnits: ["反対の意味の言葉", "似た意味の言葉", "なかまの言葉", "カタカナで書く言葉", "様子を表す言葉"],
    visualTemplate: null,
  },
  {
    id: "sentences",
    unit: "文の組み立て",
    subUnits: ["主語と述語", "つなぎ言葉", "助詞（は・を・へ）", "文の終わり（句読点）"],
    visualTemplate: null,
  },
  {
    id: "reading-story",
    unit: "お話の読解",
    subUnits: ["登場人物の気持ち", "場面の移り変わり", "すきなところとその理由"],
    visualTemplate: null,
  },
  {
    id: "reading-explanation",
    unit: "説明文の読解",
    subUnits: ["問いと答え", "順序を表す言葉", "大事な内容の読み取り"],
    visualTemplate: null,
  },
  {
    id: "composition",
    unit: "作文と表現",
    subUnits: ["楽しかったことの記録", "順序よく書く", "手紙や案内文"],
    visualTemplate: null,
  },
] as const;

export type Grade2JapaneseCurriculumUnit = (typeof GRADE_2_JAPANESE_CURRICULUM)[number];
export type Grade2JapaneseUnit = Grade2JapaneseCurriculumUnit["unit"];
export type Grade2JapaneseUnitId = Grade2JapaneseCurriculumUnit["id"];

type UnitsOf<Entries extends readonly { unit: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { unit: infer Unit } ? Unit : never;
};
type Grade2JapaneseUnitTuple = UnitsOf<typeof GRADE_2_JAPANESE_CURRICULUM>;

/** Canonical Japanese unit names as a non-empty tuple so it can feed `z.enum`. */
export const GRADE_2_JAPANESE_UNITS = GRADE_2_JAPANESE_CURRICULUM.map(
  ({ unit }) => unit,
) as unknown as Grade2JapaneseUnitTuple;

export const isGrade2JapaneseUnit = (value: string): value is Grade2JapaneseUnit =>
  GRADE_2_JAPANESE_UNITS.some((unit) => unit === value);

export const getGrade2JapaneseUnit = (unit: Grade2JapaneseUnit) =>
  GRADE_2_JAPANESE_CURRICULUM.find((entry) => entry.unit === unit);
