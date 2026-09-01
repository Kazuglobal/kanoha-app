export const GRADE_2_MATH_CURRICULUM = [
  {
    id: "tables-and-graphs",
    unit: "表とグラフ",
    subUnits: ["表の読み方", "グラフの読み方"],
    visualTemplate: "tables-and-graphs",
  },
  {
    id: "time",
    unit: "時こくと時間",
    subUnits: ["時こく", "時間", "午前と午後"],
    visualTemplate: "time",
  },
  {
    id: "addition",
    unit: "たし算",
    subUnits: ["2けたのたし算", "くり上がり", "たし算の文章題"],
    visualTemplate: "addition",
  },
  {
    id: "subtraction",
    unit: "ひき算",
    subUnits: ["2けたのひき算", "くり下がり", "ひき算の文章題"],
    visualTemplate: "subtraction",
  },
  {
    id: "length",
    unit: "長さ",
    subUnits: ["cmとmm", "mとcm", "長さのたし算とひき算"],
    visualTemplate: "length",
  },
  {
    id: "volume",
    unit: "水のかさ",
    subUnits: ["LとdL", "LとmL", "かさのたし算とひき算"],
    visualTemplate: "volume",
  },
  {
    id: "shapes",
    unit: "三角形と四角形",
    subUnits: ["三角形", "四角形", "直角", "長方形と正方形"],
    visualTemplate: "shapes",
  },
  {
    id: "multiplication",
    unit: "かけ算",
    subUnits: ["かけ算の意味", "九九", "かけ算の文章題"],
    visualTemplate: "multiplication",
  },
  {
    id: "large-numbers",
    unit: "1000より大きい数",
    subUnits: ["10000までの数", "数のしくみ", "数の大小"],
    visualTemplate: "place-value",
  },
  {
    id: "fractions",
    unit: "分数",
    subUnits: ["分けた大きさ", "2分の1", "4分の1"],
    visualTemplate: "fractions",
  },
  {
    id: "boxes",
    unit: "はこの形",
    subUnits: ["面", "辺", "頂点", "はこの組み立て"],
    visualTemplate: "boxes",
  },
] as const;

export type Grade2MathCurriculumUnit = (typeof GRADE_2_MATH_CURRICULUM)[number];
export type Grade2MathUnit = Grade2MathCurriculumUnit["unit"];
export type Grade2MathUnitId = Grade2MathCurriculumUnit["id"];

type UnitsOf<Entries extends readonly { unit: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { unit: infer Unit } ? Unit : never;
};
type Grade2MathUnitTuple = UnitsOf<typeof GRADE_2_MATH_CURRICULUM>;

/** Canonical unit names as a non-empty tuple so it can feed `z.enum`. */
export const GRADE_2_MATH_UNITS = GRADE_2_MATH_CURRICULUM.map(
  ({ unit }) => unit,
) as unknown as Grade2MathUnitTuple;

export const isGrade2MathUnit = (value: string): value is Grade2MathUnit =>
  GRADE_2_MATH_UNITS.some((unit) => unit === value);

export const getGrade2MathUnit = (unit: Grade2MathUnit) =>
  GRADE_2_MATH_CURRICULUM.find((entry) => entry.unit === unit);

