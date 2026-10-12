export const GRADE_4_MATH_CURRICULUM = [
  {
    id: "large-numbers",
    unit: "大きい数のしくみ",
    subUnits: ["億と兆の位", "10倍・100倍・10分の1", "大きな数の計算"],
    visualTemplate: "place-value",
  },
  {
    id: "division",
    unit: "わり算の筆算",
    subUnits: ["何十・何百のわり算", "1けたでわる筆算", "2けたでわる筆算", "わり算のきまりと文章題"],
    visualTemplate: "multiplication",
  },
  {
    id: "angles",
    unit: "角の大きさ",
    subUnits: ["角のはかり方", "三角定規の角", "角の計算"],
    visualTemplate: "time",
  },
  {
    id: "quadrilaterals",
    unit: "垂直・平行と四角形",
    subUnits: ["垂直と平行", "台形と平行四辺形", "ひし形と対角線"],
    visualTemplate: "shapes",
  },
  {
    id: "line-graphs",
    unit: "折れ線グラフと表",
    subUnits: ["折れ線グラフの読み方", "変わり方の読み取り", "2つのことがらの表"],
    visualTemplate: "tables-and-graphs",
  },
  {
    id: "decimals",
    unit: "小数のしくみと計算",
    subUnits: ["小数の位としくみ", "小数のたし算とひき算", "小数のかけ算とわり算"],
    visualTemplate: "volume",
  },
  {
    id: "area",
    unit: "面積",
    subUnits: ["長方形と正方形の面積", "大きな面積の単位", "いろいろな形の面積"],
    visualTemplate: "length",
  },
  {
    id: "rounding",
    unit: "がい数とその計算",
    subUnits: ["四捨五入", "以上・以下・未満", "がい数の見積もり"],
    visualTemplate: "organizing",
  },
  {
    id: "order-of-operations",
    unit: "計算のきまり",
    subUnits: ["かっこのある計算", "かけ算とわり算が先の計算", "計算のくふう"],
    visualTemplate: "addition",
  },
  {
    id: "fractions",
    unit: "分数",
    subUnits: ["真分数・仮分数・帯分数", "仮分数と帯分数のなおし方", "分数のたし算とひき算"],
    visualTemplate: "fractions",
  },
  {
    id: "patterns",
    unit: "変わり方調べ",
    subUnits: ["ともなって変わる2つの数", "表からきまりを見つける", "式に表す"],
    visualTemplate: "subtraction",
  },
  {
    id: "cuboids",
    unit: "直方体と立方体",
    subUnits: ["面・辺・頂点", "展開図と見取図", "面や辺の垂直と平行"],
    visualTemplate: "boxes",
  },
] as const;

export type Grade4MathCurriculumUnit = (typeof GRADE_4_MATH_CURRICULUM)[number];
export type Grade4MathUnit = Grade4MathCurriculumUnit["unit"];
export type Grade4MathUnitId = Grade4MathCurriculumUnit["id"];

type UnitsOf<Entries extends readonly { unit: string }[]> = {
  readonly [Index in keyof Entries]: Entries[Index] extends { unit: infer Unit } ? Unit : never;
};
type Grade4MathUnitTuple = UnitsOf<typeof GRADE_4_MATH_CURRICULUM>;

/** Canonical unit names as a non-empty tuple so it can feed `z.enum`. */
export const GRADE_4_MATH_UNITS = GRADE_4_MATH_CURRICULUM.map(
  ({ unit }) => unit,
) as unknown as Grade4MathUnitTuple;

export const isGrade4MathUnit = (value: string): value is Grade4MathUnit =>
  GRADE_4_MATH_UNITS.some((unit) => unit === value);

export const getGrade4MathUnit = (unit: Grade4MathUnit) =>
  GRADE_4_MATH_CURRICULUM.find((entry) => entry.unit === unit);

/**
 * 単元名から対応する図解テンプレートSVG名(visualTemplate)を柔軟に解決する。
 * 小4の単元名およびキーワード・表記ゆれに対応。
 */
export function resolveVisualTemplate(unit: string): string | null {
  if (!unit) return null;
  const trimmed = unit.trim();

  // 1. 完全一致
  const exact = GRADE_4_MATH_CURRICULUM.find((e) => e.unit === trimmed);
  if (exact) return exact.visualTemplate;

  // 2. 部分一致・単元キーワードによるエイリアス解決
  if (
    trimmed.includes("小数") ||
    trimmed.includes("かさ") ||
    trimmed.includes("水") ||
    trimmed.includes("mL") ||
    trimmed.includes("dL") ||
    trimmed.includes("リットル")
  ) {
    return "volume";
  }
  if (
    trimmed.includes("計算のきまり") ||
    trimmed.includes("かっこ") ||
    trimmed.includes("分配") ||
    trimmed.includes("たし") ||
    trimmed.includes("足し") ||
    trimmed.includes("くり上がり") ||
    trimmed.includes("加算")
  ) {
    return "addition";
  }
  if (
    trimmed.includes("変わり方") ||
    trimmed.includes("ともなって") ||
    trimmed.includes("ひき") ||
    trimmed.includes("引き") ||
    trimmed.includes("くり下がり") ||
    trimmed.includes("減算")
  ) {
    return "subtraction";
  }
  if (
    trimmed.includes("わり算") ||
    trimmed.includes("割り算") ||
    trimmed.includes("筆算") ||
    trimmed.includes("かけ") ||
    trimmed.includes("掛け") ||
    trimmed.includes("九九") ||
    trimmed.includes("乗算")
  ) {
    return "multiplication";
  }
  if (
    trimmed.includes("垂直") ||
    trimmed.includes("平行") ||
    trimmed.includes("四角形") ||
    trimmed.includes("台形") ||
    trimmed.includes("ひし形") ||
    trimmed.includes("対角線") ||
    trimmed.includes("長方形と正方形")
  ) {
    return "shapes";
  }
  if (
    trimmed.includes("面積") ||
    trimmed.includes("アール") ||
    trimmed.includes("ヘクタール") ||
    trimmed.includes("長") ||
    trimmed.includes("ながさ") ||
    trimmed.includes("cm") ||
    trimmed.includes("mm") ||
    trimmed.includes("メートル")
  ) {
    return "length";
  }
  if (
    trimmed.includes("角の大きさ") ||
    trimmed.includes("分度器") ||
    trimmed.includes("三角定規") ||
    trimmed.includes("角度") ||
    trimmed.includes("直角") ||
    trimmed.includes("時") ||
    trimmed.includes("とけい") ||
    trimmed.includes("時計") ||
    trimmed.includes("午前") ||
    trimmed.includes("午後")
  ) {
    return "time";
  }
  if (
    trimmed.includes("直方体") ||
    trimmed.includes("立方体") ||
    trimmed.includes("展開図") ||
    trimmed.includes("見取図") ||
    trimmed.includes("はこの形") ||
    trimmed.includes("はこのかたち") ||
    trimmed.includes("箱") ||
    trimmed.includes("はこの組み立て") ||
    trimmed.includes("頂点") ||
    trimmed.includes("辺")
  ) {
    return "boxes";
  }
  if (
    trimmed.includes("形") ||
    trimmed.includes("しかく") ||
    trimmed.includes("さんかく") ||
    trimmed.includes("角")
  ) {
    return "shapes";
  }
  if (
    trimmed.includes("がい数") ||
    trimmed.includes("概数") ||
    trimmed.includes("四捨五入") ||
    trimmed.includes("見積もり") ||
    trimmed.includes("整理") ||
    trimmed.includes("なかまわけ") ||
    trimmed.includes("分類")
  ) {
    return "organizing";
  }
  if (
    trimmed.includes("分数") ||
    trimmed.includes("真分数") ||
    trimmed.includes("仮分数") ||
    trimmed.includes("帯分数") ||
    trimmed.includes("分の") ||
    trimmed.includes("ぶんすう")
  ) {
    return "fractions";
  }
  if (
    trimmed.includes("折れ線") ||
    trimmed.includes("グラフ") ||
    trimmed.includes("表と") ||
    trimmed.includes("表の") ||
    trimmed.includes("ひょう")
  ) {
    return "tables-and-graphs";
  }
  if (
    trimmed.includes("大きい数") ||
    trimmed.includes("大きな数") ||
    trimmed.includes("億") ||
    trimmed.includes("兆") ||
    trimmed.includes("数") ||
    trimmed.includes("1000") ||
    trimmed.includes("10000") ||
    trimmed.includes("位")
  ) {
    return "place-value";
  }
  return null;
}
