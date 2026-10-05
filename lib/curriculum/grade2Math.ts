export const GRADE_2_MATH_CURRICULUM = [
  {
    id: "tables-and-graphs",
    unit: "表とグラフ",
    subUnits: ["表の読み方", "グラフの読み方"],
    visualTemplate: "tables-and-graphs",
  },
  {
    id: "organizing",
    unit: "整理する力",
    subUnits: ["なかまわけ", "整理してかぞえる", "表や図にあらわす"],
    visualTemplate: "organizing",
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
    subUnits: ["2けたのたし算", "くり上がり", "3けたになるたし算", "計算のくふう", "たし算の文章題"],
    visualTemplate: "addition",
  },
  {
    id: "subtraction",
    unit: "ひき算",
    subUnits: ["2けたのひき算", "くり下がり", "百の位からのくり下がり", "ひき算の文章題"],
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
    subUnits: ["1000までの数", "10000までの数", "数のしくみ", "数の大小"],
    visualTemplate: "place-value",
  },
  {
    id: "fractions",
    unit: "分数",
    subUnits: ["分けた大きさ", "2分の1", "4分の1", "8分の1"],
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

/**
 * 単元名から対応する図解テンプレートSVG名(visualTemplate)を柔軟に解決する。
 * 「かさ」「水のかさ」「たし算」「たしざん」などの表記ゆれに対応。
 */
export function resolveVisualTemplate(unit: string): string | null {
  if (!unit) return null;
  const trimmed = unit.trim();

  // 1. 完全一致
  const exact = GRADE_2_MATH_CURRICULUM.find((e) => e.unit === trimmed);
  if (exact) return exact.visualTemplate;

  // 2. 部分一致・単元キーワードによるエイリアス解決
  if (trimmed.includes("かさ") || trimmed.includes("水") || trimmed.includes("mL") || trimmed.includes("dL") || trimmed.includes("リットル")) {
    return "volume";
  }
  if (trimmed.includes("たし") || trimmed.includes("足し") || trimmed.includes("くり上がり") || trimmed.includes("加算")) {
    return "addition";
  }
  if (trimmed.includes("ひき") || trimmed.includes("引き") || trimmed.includes("くり下がり") || trimmed.includes("減算")) {
    return "subtraction";
  }
  if (trimmed.includes("かけ") || trimmed.includes("掛け") || trimmed.includes("九九") || trimmed.includes("乗算")) {
    return "multiplication";
  }
  if (trimmed.includes("長方形") || trimmed.includes("正方形") || trimmed.includes("直角")) {
    return "shapes";
  }
  if (trimmed.includes("長") || trimmed.includes("ながさ") || trimmed.includes("cm") || trimmed.includes("mm") || trimmed.includes("メートル")) {
    return "length";
  }
  if (trimmed.includes("時") || trimmed.includes("とけい") || trimmed.includes("時計") || trimmed.includes("午前") || trimmed.includes("午後")) {
    return "time";
  }
  if (trimmed.includes("はこの形") || trimmed.includes("はこのかたち") || trimmed.includes("箱") || trimmed.includes("はこの組み立て") || trimmed.includes("頂点") || trimmed.includes("辺")) {
    return "boxes";
  }
  if (trimmed.includes("形") || trimmed.includes("しかく") || trimmed.includes("さんかく") || trimmed.includes("直角") || trimmed.includes("長方形") || trimmed.includes("正方形")) {
    return "shapes";
  }
  if (trimmed.includes("整理") || trimmed.includes("なかまわけ") || trimmed.includes("分類")) {
    return "organizing";
  }
  if (trimmed.includes("分数") || trimmed.includes("分の") || trimmed.includes("ぶんすう")) {
    return "fractions";
  }
  if (trimmed.includes("グラフ") || trimmed.includes("表と") || trimmed.includes("表の") || trimmed.includes("ひょう")) {
    return "tables-and-graphs";
  }
  if (trimmed.includes("数") || trimmed.includes("1000") || trimmed.includes("10000") || trimmed.includes("位")) {
    return "place-value";
  }
  return null;
}

