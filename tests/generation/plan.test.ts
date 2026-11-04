import { describe, expect, it } from "vitest";
import { planBatch, type BankCandidate, type PlanInput, type PlanItem, type SkillState } from "@/lib/generation/plan";
import { generateProblem, hasGenerator } from "@/lib/generation/registry";
import { BANK_LEVEL } from "@/lib/learning/level";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 3, 0, 0);

const ADDITION = ["2けたのたし算", "くり上がり", "3けたになるたし算", "計算のくふう", "たし算の文章題"];
const SUBTRACTION = ["2けたのひき算", "くり下がり", "百の位からのくり下がり", "ひき算の文章題"];

const state = (subUnit: string, over: Partial<SkillState> = {}, unit = "たし算"): SkillState => ({
  unit,
  subUnit,
  level: 2,
  up: 0,
  down: 0,
  status: "steady",
  attempts: 6,
  accuracy: 0.8,
  lastAt: NOW - DAY,
  ...over,
});

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  subject: "math",
  states: [],
  unlockedUnits: ["たし算", "ひき算"],
  lockedUnits: ["水のかさ", "長さ"],
  bank: [],
  seed: "child1:2026-10-28",
  seq: 0,
  ...over,
});

/** 足し算・ひき算の 9 つの小単元ぜんぶに状態をつける。 */
const allSteady = (over: (subUnit: string) => Partial<SkillState> = () => ({})): SkillState[] => [
  ...ADDITION.map((subUnit) => state(subUnit, over(subUnit))),
  ...SUBTRACTION.map((subUnit) => state(subUnit, over(subUnit), "ひき算")),
];

const keyOf = (item: PlanItem) => `${item.unit}/${item.subUnit}`;
const countBy = (items: readonly PlanItem[], pick: (item: PlanItem) => string) =>
  items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [pick(item)]: (acc[pick(item)] ?? 0) + 1 }), {});

describe("planBatch: 基本", () => {
  it("履歴がなければ、解放ずみの単元から 5 問、レベル 2 で出す", () => {
    const plan = planBatch(input());
    expect(plan).toHaveLength(5);
    for (const item of plan) {
      expect(["たし算", "ひき算"]).toContain(item.unit);
      expect(item.kind).toBe("generated");
      expect(item.level).toBe(2);
      expect(item.reason).toBe("practice");
    }
  });

  it("まだ解放されていない単元は出ない", () => {
    for (const seq of [0, 1, 2, 3]) {
      for (const item of planBatch(input({ seq, states: allSteady() }))) expect(["たし算", "ひき算"]).toContain(item.unit);
    }
  });

  it("同じ入力なら同じ計画。seq が変わると 別の seed の問題になる", () => {
    const first = planBatch(input({ states: allSteady() }));
    expect(planBatch(input({ states: allSteady() }))).toEqual(first);
    const next = planBatch(input({ states: allSteady(), seq: 1 }));
    expect(next).not.toEqual(first);
    const seeds = [...first, ...next].map((item) => (item.kind === "generated" ? item.seed : item.bankId));
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("seq が変わると、小単元の組み合わせも かわる(候補が多いとき)", () => {
    const compositions = [0, 1, 2].map((seq) => planBatch(input({ states: allSteady(), seq })).map(keyOf).join("|"));
    expect(new Set(compositions).size).toBeGreaterThanOrEqual(2);
  });

  it("入力を書きかえない", () => {
    const frozen = input({ states: Object.freeze(allSteady().map((item) => Object.freeze(item))) as SkillState[] });
    expect(() => planBatch(frozen)).not.toThrow();
  });

  it("size を指定できる", () => {
    expect(planBatch(input({ size: 3 }))).toHaveLength(3);
    expect(planBatch(input({ size: 7 }))).toHaveLength(7);
  });

  it("同じ小単元は 1 回の計画に 2 問まで。候補が足りなければ 短くなる", () => {
    const plan = planBatch(input({ size: 8, unlockedUnits: ["たし算"], states: ADDITION.map((subUnit) => state(subUnit)) }));
    expect(plan).toHaveLength(8);
    expect(Math.max(...Object.values(countBy(plan, keyOf)))).toBeLessThanOrEqual(2);
    const long = planBatch(input({ size: 14, unlockedUnits: ["たし算"], states: ADDITION.map((subUnit) => state(subUnit)) }));
    expect(long).toHaveLength(10);
  });

  it("解放された単元がなく、問題バンクもなければ 空", () => {
    expect(planBatch(input({ unlockedUnits: [] }))).toEqual([]);
  });

  it("生成した seed で、決めたレベルの問題がつくれる", () => {
    for (const item of planBatch(input({ states: allSteady() }))) {
      expect(item.kind).toBe("generated");
      if (item.kind !== "generated") continue;
      expect(hasGenerator(item.unit, item.subUnit)).toBe(true);
      const problem = generateProblem({ unit: item.unit, subUnit: item.subUnit, level: item.level, seed: item.seed });
      expect(problem.level).toBe(item.level);
    }
  });
});

describe("planBatch: おさらい(review)と背のび(stretch)", () => {
  it("苦手(review)は 2 枠、レベルを 1 つ下げて、正答率の低い順に出す", () => {
    const states = allSteady((subUnit) => (subUnit === "くり上がり" ? { status: "review", level: 3, accuracy: 0.2, down: 1 } : subUnit === "くり下がり" ? { status: "review", level: 4, accuracy: 0.4, down: 1 } : subUnit === "計算のくふう" ? { status: "review", level: 2, accuracy: 0.6, down: 1 } : {}));
    const plan = planBatch(input({ states }));
    const reviews = plan.filter((item) => item.reason === "review");
    expect(reviews).toHaveLength(2);
    expect(reviews.map(keyOf).sort()).toEqual(["たし算/くり上がり", "ひき算/くり下がり"].sort());
    const byKey = Object.fromEntries(reviews.map((item) => [keyOf(item), item.level]));
    expect(byKey["たし算/くり上がり"]).toBe(2);
    expect(byKey["ひき算/くり下がり"]).toBe(3);
  });

  it("苦手が 3 つ以上あるときは、計画ごとに順番にまわる(seq)", () => {
    const states = allSteady((subUnit) => (["くり上がり", "くり下がり", "計算のくふう"].includes(subUnit) ? { status: "review", accuracy: 0.3, down: 1 } : {}));
    const seen = new Set<string>();
    for (const seq of [0, 1, 2]) for (const item of planBatch(input({ states, seq })).filter((entry) => entry.reason === "review")) seen.add(keyOf(item));
    expect(seen.size).toBe(3);
  });

  it("続けてできている(ready)小単元は、レベルを 1 つ上げて 2 枠まで出す(上限は 5)", () => {
    const states = allSteady((subUnit) => (subUnit === "2けたのたし算" ? { status: "ready", level: 2, up: 2 } : subUnit === "2けたのひき算" ? { status: "ready", level: 4, up: 2 } : {}));
    const plan = planBatch(input({ states }));
    const stretches = plan.filter((item) => item.reason === "stretch");
    expect(stretches).toHaveLength(2);
    const byKey = Object.fromEntries(stretches.map((item) => [keyOf(item), item.level]));
    expect(byKey["たし算/2けたのたし算"]).toBe(3);
    expect(byKey["ひき算/2けたのひき算"]).toBe(5);
  });

  it("ふつうの小単元は、いまのレベルで出す", () => {
    const states = allSteady((subUnit) => ({ level: subUnit === "くり上がり" ? 4 : 2 }));
    const plan = planBatch(input({ states }));
    for (const item of plan.filter((entry) => entry.reason === "practice")) {
      expect(item.level).toBe(item.subUnit === "くり上がり" ? 4 : 2);
    }
  });

  it("最初の 1 問と、最後の 1 問は 背のび問題にしない", () => {
    const states = allSteady((subUnit) => (["2けたのたし算", "くり上がり", "2けたのひき算", "くり下がり"].includes(subUnit) ? { status: subUnit.includes("上") || subUnit.includes("2けたのたし") ? "ready" : "review", up: 2, down: 1 } : {}));
    for (const seq of [0, 1, 2, 3]) {
      const plan = planBatch(input({ states, seq }));
      expect(plan[0].reason).not.toBe("stretch");
      expect(plan[plan.length - 1].reason).not.toBe("stretch");
    }
  });

  it("新しい小単元(new)は 1 回に 2 つまで。のこりは なれた小単元", () => {
    const states = ADDITION.map((subUnit) => state(subUnit));
    const plan = planBatch(input({ states, unlockedUnits: ["たし算", "ひき算"] }));
    const fresh = plan.filter((item) => SUBTRACTION.includes(item.subUnit));
    expect(fresh.length).toBeLessThanOrEqual(2);
    expect(plan.filter((item) => ADDITION.includes(item.subUnit)).length).toBeGreaterThanOrEqual(3);
  });
});

describe("planBatch: 問題バンクの枠", () => {
  const bank = (id: string, unit: string, subUnit: string): BankCandidate => ({ id, unit, subUnit });

  it("生成器のない小単元(表とグラフ)は、まだ解いていないバンク問題を 1 問 入れる", () => {
    const plan = planBatch(input({ unlockedUnits: ["たし算", "表とグラフ"], bank: [bank("tg-1", "表とグラフ", "表の読み方"), bank("tg-2", "表とグラフ", "グラフの読み方")] }));
    const items = plan.filter((item) => item.kind === "bank");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "bank", unit: "表とグラフ", level: BANK_LEVEL, reason: "practice" });
    expect(["tg-1", "tg-2"]).toContain(items[0].kind === "bank" ? items[0].bankId : "");
    expect(plan).toHaveLength(5);
  });

  it("バンクが空・単元が未解放・小単元に生成器がある(たし算)ときは バンクの枠を作らない", () => {
    expect(planBatch(input({ unlockedUnits: ["たし算", "表とグラフ"], bank: [] })).some((item) => item.kind === "bank")).toBe(false);
    expect(planBatch(input({ bank: [bank("tg-1", "表とグラフ", "表の読み方")] })).some((item) => item.kind === "bank")).toBe(false);
    expect(planBatch(input({ bank: [bank("add-1", "たし算", "くり上がり")] })).some((item) => item.kind === "bank")).toBe(false);
  });

  it("生成器のある単元がひとつも解放されていなければ、バンク問題だけで計画する", () => {
    const entries = Array.from({ length: 7 }, (_, index) => bank(`tg-${index}`, "表とグラフ", "表の読み方"));
    const plan = planBatch(input({ unlockedUnits: ["表とグラフ"], bank: entries }));
    expect(plan).toHaveLength(5);
    expect(plan.every((item) => item.kind === "bank")).toBe(true);
    expect(new Set(plan.map((item) => (item.kind === "bank" ? item.bankId : ""))).size).toBe(5);
  });

  it("計画ごとに、別のバンク問題がまわってくる(seq)", () => {
    const entries = Array.from({ length: 4 }, (_, index) => bank(`tg-${index}`, "表とグラフ", "表の読み方"));
    const ids = new Set<string>();
    for (const seq of [0, 1, 2, 3, 4, 5]) {
      for (const item of planBatch(input({ unlockedUnits: ["たし算", "表とグラフ"], bank: entries, seq }))) if (item.kind === "bank") ids.add(item.bankId);
    }
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });
});

describe("planBatch: 次の単元の先出し(preview)", () => {
  const strong = (count: number): SkillState[] => allSteady().map((item, index): SkillState => (index < count ? { ...item, level: 3 } : item));

  it("解放ずみの小単元の 7 割が レベル 3 以上なら、次の鍵の単元を レベル 1 で 1 問だけ先に出す", () => {
    const plan = planBatch(input({ states: strong(7) }));
    const previews = plan.filter((item) => item.reason === "preview");
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({ unit: "水のかさ", subUnit: "LとdL", level: 1, kind: "generated" });
    expect(plan).toHaveLength(5);
  });

  it("7 割に届かなければ 先出ししない", () => {
    expect(planBatch(input({ states: strong(6) })).some((item) => item.reason === "preview")).toBe(false);
    expect(planBatch(input({ states: strong(7), lockedUnits: [] })).some((item) => item.reason === "preview")).toBe(false);
  });

  it("先出しの単元に生成器がないときは、そのつぎの単元から さがす", () => {
    const plan = planBatch(input({ states: strong(9), lockedUnits: ["三角形と四角形", "長さ"] }));
    expect(plan.find((item) => item.reason === "preview")).toMatchObject({ unit: "長さ", subUnit: "cmとmm", level: 1 });
  });
});

describe("planBatch: 他の教科", () => {
  it("英語: 解放された単元の小単元から出る", () => {
    const plan = planBatch({ subject: "english", states: [], unlockedUnits: ["あいさつ", "えいごのかず"], lockedUnits: ["いろ"], bank: [], seed: "c:d", seq: 0 });
    expect(plan).toHaveLength(5);
    for (const item of plan) expect(["あいさつ", "えいごのかず"]).toContain(item.unit);
  });

  it("国語: 読解(お話の読解)は 生成器がないので バンクの枠になる", () => {
    const plan = planBatch({
      subject: "japanese",
      states: [],
      unlockedUnits: ["漢字", "お話の読解"],
      lockedUnits: [],
      bank: [{ id: "story-1", unit: "お話の読解", subUnit: "登場人物の気持ち" }],
      seed: "c:d",
      seq: 0,
    });
    expect(plan.filter((item) => item.kind === "bank")).toHaveLength(1);
    expect(plan.filter((item) => item.kind === "generated").every((item) => item.unit === "漢字")).toBe(true);
  });
});
