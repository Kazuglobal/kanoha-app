import "server-only";

/** 筆算で数えるくらい。 */
export const PLACE_NAMES = ["いちのくらい", "じゅうのくらい", "ひゃくのくらい", "せんのくらい"] as const;

export interface Range {
  readonly min: number;
  readonly max: number;
}

export const r = (min: number, max: number): Range => ({ min, max });

/** 2 つの数をえらぶ範囲。step が 10 なら 10 の倍数だけ。 */
export interface PairSpace {
  readonly a: Range;
  readonly b: Range;
  readonly step?: number;
}

const drawIn = (random: () => number, range: Range, step: number): number => {
  const low = Math.ceil(range.min / step);
  const high = Math.floor(range.max / step);
  return (low + Math.floor(random() * (high - low + 1))) * step;
};

/** 範囲全体を小さい順に調べて、最初に条件に合う組を返す(乱数で見つからなかったときの保険)。 */
function scanPair(space: PairSpace, accept: (a: number, b: number) => boolean): readonly [number, number] {
  const step = space.step ?? 1;
  for (let a = Math.ceil(space.a.min / step) * step; a <= space.a.max; a += step) {
    for (let b = Math.ceil(space.b.min / step) * step; b <= space.b.max; b += step) {
      if (accept(a, b)) return [a, b];
    }
  }
  throw new RangeError("no pair of numbers satisfies the rule");
}

/** 範囲の中から、条件に合う 2 つの数を乱数でえらぶ。乱数は seed で決まるので、同じ seed なら同じ組になる。 */
export function pickPair(
  random: () => number,
  space: PairSpace,
  accept: (a: number, b: number) => boolean,
): readonly [number, number] {
  const step = space.step ?? 1;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const a = drawIn(random, space.a, step);
    const b = drawIn(random, space.b, step);
    if (accept(a, b)) return [a, b];
  }
  return scanPair(space, accept);
}

/** n の place けた目(0 = 一の位)の数字。 */
export const digitAt = (n: number, place: number): number => Math.floor(n / 10 ** place) % 10;

const digitCount = (n: number): number => String(n).length;

/** くり上がり・くり下がりが起きる位。ones は「一の位で」、tens は「十の位で」、hundreds は「百の位で」起きるか。 */
export interface Marks {
  readonly ones: boolean;
  readonly tens: boolean;
  readonly hundreds: boolean;
}

/** たし算 a + b で、上の位へくり上げる位。 */
export function carriesOf(a: number, b: number): Marks {
  const ones = digitAt(a, 0) + digitAt(b, 0) >= 10;
  const tens = digitAt(a, 1) + digitAt(b, 1) + (ones ? 1 : 0) >= 10;
  const hundreds = digitAt(a, 2) + digitAt(b, 2) + (tens ? 1 : 0) >= 10;
  return { ones, tens, hundreds };
}

/** ひき算 a - b(a >= b)で、上の位からかりる位。 */
export function borrowsOf(a: number, b: number): Marks {
  const ones = digitAt(a, 0) < digitAt(b, 0);
  const tens = digitAt(a, 1) - (ones ? 1 : 0) < digitAt(b, 1);
  const hundreds = digitAt(a, 2) - (tens ? 1 : 0) < digitAt(b, 2);
  return { ones, tens, hundreds };
}

/** たし算の筆算のようすを、位ごとの文にする(解き方のヒント用)。 */
export function addSteps(a: number, b: number): string {
  const places = Math.max(digitCount(a), digitCount(b));
  let carry = 0;
  const lines: string[] = [];
  for (let place = 0; place < places; place += 1) {
    const x = digitAt(a, place);
    const y = digitAt(b, place);
    const total = x + y + carry;
    lines.push(`${PLACE_NAMES[place]}は ${x}+${y}${carry ? "+1" : ""}=${total}${total >= 10 ? "(くりあげ)" : ""}`);
    carry = total >= 10 ? 1 : 0;
  }
  if (carry) lines.push(`${PLACE_NAMES[places]}に 1`);
  return `${lines.join("、")}。だから ${a + b}。`;
}

/** ひき算の筆算のようすを、位ごとの文にする(解き方のヒント用)。 */
export function subSteps(a: number, b: number): string {
  const places = Math.max(digitCount(a), digitCount(b));
  let lent = 0;
  const lines: string[] = [];
  for (let place = 0; place < places; place += 1) {
    const name = PLACE_NAMES[place];
    const here = digitAt(a, place) - lent;
    const y = digitAt(b, place);
    if (here < y) {
      lines.push(
        here < 0
          ? `${name}は 0 から かりているので 9 に なって、9-${y}=${9 - y}`
          : `${name}は ${here} から ${y} は ひけないので、1 かりて ${here + 10}-${y}=${here + 10 - y}`,
      );
      lent = 1;
    } else {
      lines.push(`${name}は ${here}-${y}=${here - y}`);
      lent = 0;
    }
  }
  return `${lines.join("、")}。だから ${a - b}。`;
}
