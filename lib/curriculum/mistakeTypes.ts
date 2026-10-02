export const MISTAKE_TYPES = [
  {
    id: "calculation_error",
    label: "計算まちがい",
    description: "計算の途中で数をまちがえた",
  },
  {
    id: "place_value_error",
    label: "位のまちがい",
    description: "一の位、十の位、百の位を取りちがえた",
  },
  {
    id: "carry_error",
    label: "くり上がりのまちがい",
    description: "くり上がりを忘れた、または取りちがえた",
  },
  {
    id: "borrow_error",
    label: "くり下がりのまちがい",
    description: "くり下がりを忘れた、または取りちがえた",
  },
  {
    id: "operation_choice_error",
    label: "式のえらびまちがい",
    description: "たす、ひく、かけるの選び方をまちがえた",
  },
  {
    id: "unit_conversion_error",
    label: "単位のまちがい",
    description: "L、mL、cm、mmなどの単位を取りちがえた",
  },
  {
    id: "reading_comprehension_error",
    label: "問題文の読みまちがい",
    description: "問題文の条件や聞かれていることを取りちがえた",
  },
  {
    id: "multiplication_fact_error",
    label: "九九のまちがい",
    description: "九九の答えを取りちがえた",
  },
  {
    id: "time_error",
    label: "時こくと時間のまちがい",
    description: "時こくと時間を取りちがえた",
  },
  {
    id: "geometry_error",
    label: "図形のまちがい",
    description: "形、辺、頂点、直角などを取りちがえた",
  },
  {
    id: "careless_error",
    label: "見直しで直せるまちがい",
    description: "写し間違いや答え方の抜けがあった",
  },
  {
    id: "unanswered",
    label: "答えなし",
    description: "答えまで書けなかった",
  },
  {
    id: "other",
    label: "そのほか",
    description: "ほかの分類に当てはまらない",
  },
] as const;

export type MistakeType = (typeof MISTAKE_TYPES)[number]["id"];

type IdsOf<Entries extends readonly { id: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { id: infer Id } ? Id : never;
};
type MistakeTypeIdTuple = IdsOf<typeof MISTAKE_TYPES>;

/** Canonical mistake ids as a non-empty tuple so it can feed `z.enum`. */
export const MISTAKE_TYPE_IDS = MISTAKE_TYPES.map(({ id }) => id) as unknown as MistakeTypeIdTuple;

export const JAPANESE_MISTAKE_TYPES = [
  {
    id: "kanji_stroke_error",
    label: "漢字の形・とめ・はね",
    description: "漢字の形や、とめ・はね・はらい、画数をまちがえた",
  },
  {
    id: "okurigana_error",
    label: "送り仮名のまちがい",
    description: "漢字の送り仮名をまちがえた",
  },
  {
    id: "reading_error",
    label: "漢字の読みまちがい",
    description: "漢字の音読み・訓読みをまちがえた",
  },
  {
    id: "grammar_particle_error",
    label: "助詞・文のまちがい",
    description: "「は・を・へ」の助詞やつなぎ言葉をまちがえた",
  },
  {
    id: "context_comprehension_error",
    label: "気持ち・場面の読み取り",
    description: "登場人物の気持ちや場面の様子を取りちがえた",
  },
  {
    id: "word_choice_error",
    label: "ことばの選びまちがい",
    description: "反対の言葉や似た言葉の選択をまちがえた",
  },
] as const;

export type JapaneseMistakeType = (typeof JAPANESE_MISTAKE_TYPES)[number]["id"];

export const ALL_MISTAKE_TYPES = [
  ...MISTAKE_TYPES,
  ...JAPANESE_MISTAKE_TYPES,
] as const;

export type AllMistakeType = (typeof ALL_MISTAKE_TYPES)[number]["id"];

type AllIdsOf<Entries extends readonly { id: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { id: infer Id } ? Id : never;
};
export const ALL_MISTAKE_TYPE_IDS = ALL_MISTAKE_TYPES.map(({ id }) => id) as unknown as AllIdsOf<typeof ALL_MISTAKE_TYPES>;

export const isMistakeType = (value: string): value is MistakeType =>
  MISTAKE_TYPE_IDS.some((id) => id === value);

export const getMistakeType = (id: MistakeType) =>
  MISTAKE_TYPES.find((mistakeType) => mistakeType.id === id);

export const isAnyMistakeType = (value: string): value is AllMistakeType =>
  ALL_MISTAKE_TYPE_IDS.some((id) => id === value);

export const getAllMistakeType = (id: string) =>
  ALL_MISTAKE_TYPES.find((mistakeType) => mistakeType.id === id);

