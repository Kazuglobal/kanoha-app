export const GRADE_4_JAPANESE_CURRICULUM = [
  {
    id: "kanji",
    unit: "漢字",
    subUnits: ["漢字の読み", "漢字の書き", "熟語の組み立て", "都道府県名に使われる漢字"],
    visualTemplate: null,
  },
  {
    id: "vocabulary",
    unit: "ことばのきまり",
    subUnits: ["慣用句とことわざ", "類義語と対義語", "国語辞典と漢字辞典の使い方"],
    visualTemplate: null,
  },
  {
    id: "sentences",
    unit: "文の組み立て",
    subUnits: ["主語・述語と修飾語", "接続語（つなぎ言葉）", "指示語（こそあど言葉）"],
    visualTemplate: null,
  },
  {
    id: "reading-story",
    unit: "お話の読解",
    subUnits: ["登場人物の気持ちの変化", "場面の様子と情景", "行動や会話からの読み取り"],
    visualTemplate: null,
  },
  {
    id: "reading-explanation",
    unit: "説明文の読解",
    subUnits: ["問いと答え・中心となる文", "段落の役割と要約", "事実と意見の区別"],
    visualTemplate: null,
  },
  {
    id: "composition",
    unit: "作文と表現",
    subUnits: ["新聞づくりとインタビュー", "理由や例を挙げて意見を書く", "手紙や案内状を書く"],
    visualTemplate: null,
  },
] as const;

export type Grade4JapaneseCurriculumUnit = (typeof GRADE_4_JAPANESE_CURRICULUM)[number];
export type Grade4JapaneseUnit = Grade4JapaneseCurriculumUnit["unit"];
export type Grade4JapaneseUnitId = Grade4JapaneseCurriculumUnit["id"];

type UnitsOf<Entries extends readonly { unit: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { unit: infer Unit } ? Unit : never;
};
type Grade4JapaneseUnitTuple = UnitsOf<typeof GRADE_4_JAPANESE_CURRICULUM>;

/** Canonical Japanese unit names as a non-empty tuple so it can feed `z.enum`. */
export const GRADE_4_JAPANESE_UNITS = GRADE_4_JAPANESE_CURRICULUM.map(
  ({ unit }) => unit,
) as unknown as Grade4JapaneseUnitTuple;

export const isGrade4JapaneseUnit = (value: string): value is Grade4JapaneseUnit =>
  GRADE_4_JAPANESE_UNITS.some((unit) => unit === value);

export const getGrade4JapaneseUnit = (unit: Grade4JapaneseUnit) =>
  GRADE_4_JAPANESE_CURRICULUM.find((entry) => entry.unit === unit);
