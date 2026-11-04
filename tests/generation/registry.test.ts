import { describe, expect, it } from "vitest";
import { SUBJECT_CONFIG, SUBJECTS, type Subject } from "@/lib/curriculum/subjects";
import { UNIT_ENTRIES, subUnitsOf } from "@/lib/curriculum/subUnits";
import { GENERATORS, findGenerator, generateFromRef, generateProblem, generatorsForSubject, hasGenerator, parseRef } from "@/lib/generation/registry";
import { validateGenerated } from "@/lib/generation/validate";
import { LEVELS } from "@/lib/learning/level";

const SEEDS = Array.from({ length: 30 }, (_, index) => `r${index}`);

/** 生成器を持たない小単元(問題バンクの問題を使う)。増やす・減らすときは、ここも直す。 */
const BANK_ONLY: Readonly<Record<Subject, readonly string[]>> = {
  math: ["表とグラフ/表の読み方", "表とグラフ/グラフの読み方", "整理する力/なかまわけ", "整理する力/整理してかぞえる", "整理する力/表や図にあらわす", "三角形と四角形/三角形", "三角形と四角形/四角形", "三角形と四角形/直角", "三角形と四角形/長方形と正方形", "はこの形/面", "はこの形/辺", "はこの形/頂点", "はこの形/はこの組み立て"],
  japanese: ["漢字/部首と筆順", "漢字/同じ部分をもつ漢字", "ことばのきまり/似た意味の言葉", "お話の読解/登場人物の気持ち", "お話の読解/場面の移り変わり", "お話の読解/すきなところとその理由", "説明文の読解/問いと答え", "説明文の読解/順序を表す言葉", "説明文の読解/大事な内容の読み取り", "作文と表現/楽しかったことの記録", "作文と表現/順序よく書く", "作文と表現/手紙や案内文"],
  english: [],
};

describe("生成器の登録表", () => {
  it("単元 × 小単元 が重ならず、単元表にある", () => {
    const keys = GENERATORS.map((entry) => `${entry.unit}/${entry.subUnit}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of GENERATORS) {
      expect(SUBJECT_CONFIG[entry.subject].units, entry.unit).toContain(entry.unit);
      expect(subUnitsOf(entry.unit), `${entry.unit}/${entry.subUnit}`).toContain(entry.subUnit);
    }
  });

  it("小単元の名前に「/」を含まない(ref の区切りに使うため)", () => {
    for (const entries of Object.values(UNIT_ENTRIES)) {
      for (const { unit, subUnits } of entries) {
        expect(unit).not.toContain("/");
        for (const subUnit of subUnits) expect(subUnit, subUnit).not.toContain("/");
      }
    }
  });

  it.each(SUBJECTS)("%s: 生成器を持つ小単元と、問題バンクにまかせる小単元で、単元表の小単元が すべてそろう", (subject) => {
    const all = UNIT_ENTRIES[subject].flatMap(({ unit, subUnits }) => subUnits.map((subUnit) => `${unit}/${subUnit}`));
    const generated = generatorsForSubject(subject).map((entry) => `${entry.unit}/${entry.subUnit}`);
    expect([...generated, ...BANK_ONLY[subject]].sort()).toEqual([...all].sort());
  });

  it("英語は すべての小単元に生成器がある", () => {
    expect(BANK_ONLY.english).toEqual([]);
    expect(generatorsForSubject("english").length).toBeGreaterThanOrEqual(13);
  });

  it("findGenerator / hasGenerator", () => {
    expect(findGenerator("たし算", "くり上がり")?.subject).toBe("math");
    expect(findGenerator("たし算", "ないしょう")).toBeUndefined();
    expect(hasGenerator("お話の読解", "登場人物の気持ち")).toBe(false);
    expect(() => generateProblem({ unit: "お話の読解", subUnit: "登場人物の気持ち", level: 2, seed: "x" })).toThrow(RangeError);
  });
});

describe("全生成器 × レベル 1〜5 × 30 通りの seed", () => {
  it("すべて検査(validateGenerated)を通る", () => {
    const failures: string[] = [];
    for (const entry of GENERATORS) {
      for (const level of LEVELS) {
        for (const seed of SEEDS) {
          const problem = entry.generate({ unit: entry.unit, subUnit: entry.subUnit, level, seed });
          const result = validateGenerated(problem);
          if (!result.ok) failures.push(`${entry.unit}/${entry.subUnit} L${level} ${seed}: ${problem.problemText} → ${result.issues.join(", ")}`);
          if (problem.subject !== entry.subject || problem.unit !== entry.unit || problem.level !== level) failures.push(`${problem.ref}: メタ情報が合わない`);
        }
      }
    }
    // 失敗の中身が見えるように、メッセージに入れて投げる
    if (failures.length > 0) throw new Error(`${failures.length} 件の問題が検査に通らない: ${failures.slice(0, 12).join(" | ")}`);
  });

  it("ref から同じ問題を作りなおせる(保存した ref で再生成できる)", () => {
    for (const entry of GENERATORS) {
      const problem = entry.generate({ unit: entry.unit, subUnit: entry.subUnit, level: 3, seed: "re/gen:seed 1" });
      expect(generateFromRef(problem.ref)).toEqual(problem);
    }
  });

  it("parseRef: 読めない ref は null", () => {
    expect(parseRef("たし算/くり上がり/L2/abc")).toEqual({ unit: "たし算", subUnit: "くり上がり", level: 2, seed: "abc" });
    expect(parseRef("たし算/くり上がり/L2/a/b")).toMatchObject({ seed: "a/b" });
    for (const bad of ["", "たし算", "たし算/くり上がり/2/abc", "たし算/くり上がり/L6/abc", "たし算/くり上がり/L2/", "/くり上がり/L2/a"]) {
      expect(parseRef(bad), bad).toBeNull();
    }
    expect(generateFromRef("ないしょう/ない/L2/a")).toBeNull();
  });

  it("答えの分かれ方: 4択の問題は 4 つ、入力の問題は選択肢なし(教科ごとの回答方式)", () => {
    for (const subject of SUBJECTS) {
      for (const entry of generatorsForSubject(subject)) {
        for (const level of LEVELS) {
          const problem = entry.generate({ unit: entry.unit, subUnit: entry.subUnit, level, seed: "shape" });
          if (subject === "english") expect(problem.choices, `${entry.subUnit} L${level}`).toHaveLength(4);
          else if (problem.choices) expect(problem.choices).toHaveLength(4);
        }
      }
    }
  });
});
