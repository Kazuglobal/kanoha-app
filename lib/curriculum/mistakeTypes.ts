export const MISTAKE_TYPES = [
  {
    id: "calculation_error",
    label: "計算まちがい",
    description: "計算の途中で数をまちがえた",
  },
  {
    id: "place_value_error",
    label: "位・がい数のまちがい",
    description: "億・兆の位、小数の位、または四捨五入する位を取りちがえた",
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
    label: "式・計算の順序まちがい",
    description: "たす・ひく・かける・わるの選び方や、計算のきまり（順序）をまちがえた",
  },
  {
    id: "unit_conversion_error",
    label: "単位のまちがい",
    description: "面積（cm²・m²・a・ha）や角度（度）、L・mLなどの単位を取りちがえた",
  },
  {
    id: "reading_comprehension_error",
    label: "問題文の読みまちがい",
    description: "問題文の条件や聞かれていることを取りちがえた",
  },
  {
    id: "multiplication_fact_error",
    label: "かけ算・わり算の筆算まちがい",
    description: "九九やわり算の筆算の商の見当づけ・手順を取りちがえた",
  },
  {
    id: "time_error",
    label: "変わり方・グラフのまちがい",
    description: "ともなって変わる数や折れ線グラフの目盛りを取りちがえた",
  },
  {
    id: "geometry_error",
    label: "図形・角・面積のまちがい",
    description: "角の大きさ、垂直・平行、四角形、面積、直方体・立方体などを取りちがえた",
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
    label: "漢字の形・熟語の組み立て",
    description: "漢字の形や、とめ・はね・はらい、画数、熟語の構成をまちがえた",
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
    label: "主語・述語・接続語のまちがい",
    description: "主語・述語・修飾語や接続語（つなぎ言葉）・助詞をまちがえた",
  },
  {
    id: "context_comprehension_error",
    label: "気持ちの変化・段落の読み取り",
    description: "登場人物の気持ちの変化や説明文の段落の要旨を取りちがえた",
  },
  {
    id: "word_choice_error",
    label: "慣用句・ことわざ・語彙のまちがい",
    description: "慣用句・ことわざや対義語・類義語・辞典の引き方をまちがえた",
  },
] as const;

export type JapaneseMistakeType = (typeof JAPANESE_MISTAKE_TYPES)[number]["id"];

export const ENGLISH_MISTAKE_TYPES = [
  {
    id: "alphabet_error",
    label: "アルファベット・小文字のまちがい",
    description: "大文字・小文字や、にている文字を取りちがえた",
  },
  {
    id: "english_listening_error",
    label: "聞き取りのまちがい",
    description: "英語の音やフレーズを聞きちがえた",
  },
  {
    id: "english_word_error",
    label: "英語の表現・ことばのまちがい",
    description: "天気・曜日・時刻・教科・道案内などの英語表現と意味を取りちがえた",
  },
] as const;

export type EnglishMistakeType = (typeof ENGLISH_MISTAKE_TYPES)[number]["id"];

export const ALL_MISTAKE_TYPES = [
  ...MISTAKE_TYPES,
  ...JAPANESE_MISTAKE_TYPES,
  ...ENGLISH_MISTAKE_TYPES,
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
