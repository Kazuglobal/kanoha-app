import { describe, expect, it } from "vitest";
import { generateBatch, problemKey } from "@/lib/generation/batch";
import { generateFromRef, generateProblem } from "@/lib/generation/registry";
import type { PlanItem } from "@/lib/generation/plan";
import { planBatch } from "@/lib/generation/plan";
import type { GeneratedProblem } from "@/lib/generation/types";

const generatedItem = (seed: string, overrides: Partial<Extract<PlanItem, { kind: "generated" }>> = {}): Extract<PlanItem, { kind: "generated" }> => ({
  kind: "generated",
  reason: "practice",
  unit: "たし算",
  subUnit: "くり上がり",
  level: 2,
  seed,
  ...overrides,
});

describe("generateBatch: 出題計画から問題をつくる", () => {
  it("計画の順番どおりに、生成する枠は問題を、バンクの枠はそのまま返す", () => {
    const bank: PlanItem = { kind: "bank", reason: "practice", unit: "表とグラフ", subUnit: "表の読み方", level: 2, bankId: "bank-1" };
    const entries = generateBatch([generatedItem("a:0:0"), bank, generatedItem("a:0:2", { unit: "かけ算", subUnit: "九九", level: 1 })]);
    expect(entries.map((entry) => entry.kind)).toEqual(["generated", "bank", "generated"]);
    expect(entries[1]).toEqual({ kind: "bank", item: bank });
    const first = entries[0];
    expect(first.kind === "generated" && first.problem.unit).toBe("たし算");
    expect(first.kind === "generated" && first.problem.ref).toContain("たし算/くり上がり/L2/");
  });

  it("同じ入力なら同じ結果(乱数も時計も使わない)", () => {
    const items = [generatedItem("same:0:0"), generatedItem("same:0:1")];
    expect(generateBatch(items)).toEqual(generateBatch(items));
  });

  it("同じ seed の枠が 2 つあっても、同じセットに同じ問題を 2 回出さない", () => {
    const entries = generateBatch([generatedItem("dup"), generatedItem("dup")]);
    const problems = entries.flatMap((entry) => (entry.kind === "generated" ? [entry.problem] : []));
    expect(problems).toHaveLength(2);
    expect(problemKey(problems[0])).not.toBe(problemKey(problems[1]));
    expect(problems[1].ref).not.toBe(problems[0].ref);
  });

  it("やりなおした問題の ref からも、同じ問題をつくりなおせる", () => {
    const entries = generateBatch([generatedItem("dup"), generatedItem("dup"), generatedItem("dup")]);
    for (const entry of entries) {
      if (entry.kind !== "generated") throw new Error("生成できるはず");
      expect(generateFromRef(entry.problem.ref)).toEqual(entry.problem);
    }
  });

  it("生成器のない小単元の枠は unavailable(呼ぶ側がバンクの問題で代わりにする)。ほかの枠は影響を受けない", () => {
    const missing = generatedItem("x", { unit: "お話の読解", subUnit: "登場人物の気持ち" });
    const entries = generateBatch([generatedItem("ok:0:0"), missing, generatedItem("ok:0:2")]);
    expect(entries.map((entry) => entry.kind)).toEqual(["generated", "unavailable", "generated"]);
    expect(entries[1]).toEqual({ kind: "unavailable", item: missing });
  });

  it("かぶりを避けきれないときは、むりに同じ問題を出さず unavailable にする", () => {
    const constant: GeneratedProblem = generateProblem({ unit: "たし算", subUnit: "くり上がり", level: 2, seed: "const" });
    const entries = generateBatch([generatedItem("a"), generatedItem("b")], () => constant);
    expect(entries.map((entry) => entry.kind)).toEqual(["generated", "unavailable"]);
  });

  it("作れない(RangeError)枠だけが unavailable になり、ほかのエラーは そのまま投げる", () => {
    const boom = (): GeneratedProblem => {
      throw new TypeError("作りまちがい");
    };
    expect(() => generateBatch([generatedItem("a")], boom)).toThrow(TypeError);
  });

  it("実際の計画(planBatch)で、200 通りの seed のどのセットにも 同じ問題が 2 つ入らない", () => {
    for (let index = 0; index < 200; index += 1) {
      const plan = planBatch({
        subject: index % 2 === 0 ? "math" : "english",
        states: [],
        unlockedUnits: index % 2 === 0 ? ["たし算", "ひき算", "かけ算", "長さ", "水のかさ", "時こくと時間"] : ["あいさつ", "えいごのかず", "いろ", "どうぶつ"],
        lockedUnits: [],
        bank: [],
        seed: `child-${index}:2026-10-29`,
        seq: index % 3,
      });
      const keys = generateBatch(plan).flatMap((entry) => (entry.kind === "generated" ? [problemKey(entry.problem)] : []));
      expect(new Set(keys).size, `seed ${index}`).toBe(keys.length);
    }
  });
});

describe("problemKey: 同じ問題かどうかの目印", () => {
  const base = generateProblem({ unit: "たし算", subUnit: "くり上がり", level: 2, seed: "k" });

  it("問題文・聞く英語・答えが同じなら同じ(選択肢の並びや ref のちがいは見ない)", () => {
    expect(problemKey({ ...base, ref: "ほかの/ref/L1/z", choices: undefined })).toBe(problemKey(base));
  });

  it("問題文・聞く英語・答えのどれかがちがえば、ちがう問題", () => {
    expect(problemKey({ ...base, problemText: `${base.problemText}!` })).not.toBe(problemKey(base));
    expect(problemKey({ ...base, listenText: "apple" })).not.toBe(problemKey(base));
    expect(problemKey({ ...base, correctAnswer: `${base.correctAnswer}0` })).not.toBe(problemKey(base));
  });
});
