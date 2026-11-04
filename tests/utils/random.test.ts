import { describe, expect, it } from "vitest";
import { createRandom, hashSeed, pickMany, pickOne, randomInt, sampleDistinct, shuffle } from "@/lib/utils/random";

const take = (random: () => number, count: number) => Array.from({ length: count }, () => random());

describe("createRandom: 同じシードなら同じ並び", () => {
  it("同じシードは同じ数列、ちがうシードはちがう数列", () => {
    expect(take(createRandom("a"), 8)).toEqual(take(createRandom("a"), 8));
    expect(take(createRandom("a"), 8)).not.toEqual(take(createRandom("b"), 8));
  });

  it("0 以上 1 未満", () => {
    for (const value of take(createRandom("range"), 500)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("hashSeed は 32bit の非負整数(同じ文字列で同じ値)", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
    expect(Number.isInteger(hashSeed("あいう"))).toBe(true);
    expect(hashSeed("あいう")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("あいう")).toBeLessThan(2 ** 32);
  });
});

describe("shuffle / pickOne / pickMany / randomInt", () => {
  it("shuffle は並べかえた複製を返し、入力を書きかえない", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const result = shuffle(input, createRandom("s"));
    expect([...result].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shuffle(input, createRandom("s"))).toEqual(result);
  });

  it("randomInt は両端をふくむ整数で、すべての値が出る", () => {
    const random = createRandom("int");
    const seen = new Set(Array.from({ length: 300 }, () => randomInt(random, 3, 6)));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("randomInt は min が max より大きいとき RangeError", () => {
    expect(() => randomInt(createRandom("x"), 5, 4)).toThrow(RangeError);
  });

  it("pickOne は配列の中の値を返し、空の配列は RangeError", () => {
    const items = ["a", "b", "c"];
    expect(items).toContain(pickOne(createRandom("p"), items));
    expect(() => pickOne(createRandom("p"), [])).toThrow(RangeError);
  });

  it("sampleDistinct: 範囲の中から重ならない整数を選ぶ。範囲いっぱいなら すべて", () => {
    const random = createRandom("distinct");
    for (let round = 0; round < 200; round += 1) {
      const picked = sampleDistinct(random, 1000, 9999, 4);
      expect(new Set(picked).size).toBe(4);
      for (const value of picked) expect(value >= 1000 && value <= 9999).toBe(true);
    }
    expect([...sampleDistinct(random, 5, 9, 5)].sort()).toEqual([5, 6, 7, 8, 9]);
    expect(sampleDistinct(random, 3, 3, 0)).toEqual([]);
    expect(() => sampleDistinct(random, 1, 3, 4)).toThrow(RangeError);
  });

  it("sampleDistinct: どの値も出る(かたよらない)", () => {
    const random = createRandom("spread");
    const seen = new Set<number>();
    for (let round = 0; round < 300; round += 1) for (const value of sampleDistinct(random, 1, 6, 2)) seen.add(value);
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("pickMany は重ならない値を count 個返す(足りなければあるだけ)", () => {
    const picked = pickMany(createRandom("m"), [1, 2, 3, 4, 5], 3);
    expect(new Set(picked).size).toBe(3);
    expect(pickMany(createRandom("m"), [1, 2], 5)).toHaveLength(2);
    expect(pickMany(createRandom("m"), [1, 2, 3], 0)).toEqual([]);
  });
});
