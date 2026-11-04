/**
 * 文字列のシードから決まる擬似乱数(同じシードなら、いつでも同じ並びになる)。
 * 問題の自動生成・選択肢の並びなど、「同じ入力なら同じ結果」にしたいところで使う。
 */

/** 文字列シードから 32bit の整数を作る(FNV-1a)。 */
export const hashSeed = (seed: string): number =>
  [...seed].reduce((hash, char) => Math.imul(hash ^ char.codePointAt(0)!, 16_777_619) >>> 0, 2_166_136_261);

/** mulberry32: 決定的な擬似乱数(0 <= x < 1)。 */
export const createRandom = (seed: string): (() => number) => {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/** Fisher-Yates(入力は変更せず、複製をシャッフルする)。 */
export const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

/** min 以上 max 以下の整数(両端をふくむ)。 */
export const randomInt = (random: () => number, min: number, max: number): number => {
  if (max < min) throw new RangeError("max must be greater than or equal to min");
  return min + Math.floor(random() * (max - min + 1));
};

/** 配列から 1 つ選ぶ。空の配列は選べないので RangeError。 */
export const pickOne = <T>(random: () => number, items: readonly T[]): T => {
  if (items.length === 0) throw new RangeError("cannot pick from an empty list");
  return items[Math.floor(random() * items.length)];
};

/**
 * low 以上 high 以下の整数から、重ならない count 個を選ぶ(Floyd の方法。範囲が広くても count に比例する時間で済む)。
 * 範囲より多くは選べないので RangeError。
 */
export function sampleDistinct(random: () => number, low: number, high: number, count: number): number[] {
  const size = high - low + 1;
  if (count > size || count < 0) throw new RangeError("cannot sample that many distinct numbers");
  const chosen = new Set<number>();
  for (let upper = size - count; upper < size; upper += 1) {
    const pick = Math.floor(random() * (upper + 1));
    chosen.add(chosen.has(pick) ? upper : pick);
  }
  return shuffle([...chosen].map((offset) => low + offset), random);
}

/** 重ならないように count 個選ぶ(足りなければあるだけ)。 */
export const pickMany = <T>(random: () => number, items: readonly T[], count: number): T[] =>
  shuffle(items, random).slice(0, Math.max(0, count));
