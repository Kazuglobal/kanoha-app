/**
 * 類題の 4 択をサーバー側で作る純粋関数(A2 / B13)。
 * 「<数字><たんい>」の答え(例: 1000mL, 12こ, 43)から、同じたんいの誤答 3 つを決定的に選ぶ。
 * 数字で解釈できない答え(例: 3L50mL, 1/2)は null を返し、クライアントは文字入力にフォールバックする。
 */
export const CHOICE_COUNT = 4;

const ANSWER_PATTERN = /^(\d+)([^\d]*)$/;

interface ParsedAnswer {
  value: number;
  suffix: string;
}

export const parseNumericAnswer = (answer: string): ParsedAnswer | null => {
  const normalized = answer.normalize("NFKC").replace(/\s+/g, "");
  const match = normalized.match(ANSWER_PATTERN);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? { value, suffix: match[2] } : null;
};

/** 文字列シードから 32bit の整数を作る(FNV-1a)。 */
const hashSeed = (seed: string): number =>
  [...seed].reduce((hash, char) => Math.imul(hash ^ char.codePointAt(0)!, 16_777_619) >>> 0, 2_166_136_261);

/** mulberry32: 決定的な擬似乱数(0 <= x < 1)。 */
const createRandom = (seed: string): (() => number) => {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/** Fisher-Yates(入力は変更せず、複製をシャッフルする)。 */
const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

/** 小2が間違えやすい候補: ±1, ±2, ±10, ×10, ÷10, ±100, ×2 など(同じたんい、0 以上、答えと異なる)。 */
const distractorPool = (value: number): number[] => {
  const candidates = [
    value + 1, value - 1, value + 2, value - 2, value + 10, value - 10,
    value * 10, Math.floor(value / 10), value + 100, value - 100, value * 2, Math.floor(value / 2),
    value + 1000, value - 1000, value + 3, value + 5,
  ];
  return [...new Set(candidates)].filter((candidate) => Number.isSafeInteger(candidate) && candidate >= 0 && candidate !== value);
};

/**
 * 答えと誤答 3 つを決定的にシャッフルして返す。同じ (answer, seed) なら同じ並び。
 * @returns 4 つのユニークな選択肢、または数値で解釈できない場合は null
 */
export const buildChoices = (answer: string, seed: string): readonly string[] | null => {
  const parsed = parseNumericAnswer(answer);
  if (!parsed) return null;
  const random = createRandom(`${seed}:${answer}`);
  const distractors = shuffle(distractorPool(parsed.value), random).slice(0, CHOICE_COUNT - 1);
  if (distractors.length < CHOICE_COUNT - 1) return null;
  const choices = shuffle([parsed.value, ...distractors], random).map((value) => `${value}${parsed.suffix}`);
  return new Set(choices).size === CHOICE_COUNT ? choices : null;
};

/** 保存済みの choices(JSON 文字列または配列)を安全に読む。 */
export const readStoredChoices = (value: unknown): readonly string[] | null => {
  let arr = value;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      return null;
    }
  }
  return Array.isArray(arr) && arr.length === CHOICE_COUNT && arr.every((item) => typeof item === "string")
    ? (arr as string[])
    : null;
};
