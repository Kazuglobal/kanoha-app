import { classifyUtterance } from "./normalize";

/**
 * 場面の途中で変わる文脈(おみせで子どもが選んだ くだもの)。クライアントとサーバーの両方が同じ形を使う。
 * サーバーはクライアントが言う文脈を信じず、決まった ID の中のものだけ受け取る(FRUIT_IDS)。
 */

export interface ChosenFruit {
  readonly singular: string;
  readonly plural: string;
  readonly labelJa: string;
  readonly emoji: string;
}

const FRUIT_INFO: readonly ChosenFruit[] = [
  { singular: "apple", plural: "apples", labelJa: "りんご", emoji: "🍎" },
  { singular: "banana", plural: "bananas", labelJa: "バナナ", emoji: "🍌" },
  { singular: "orange", plural: "oranges", labelJa: "オレンジ", emoji: "🍊" },
  { singular: "melon", plural: "melons", labelJa: "メロン", emoji: "🍈" },
  { singular: "grape", plural: "grapes", labelJa: "ぶどう", emoji: "🍇" },
  { singular: "strawberry", plural: "strawberries", labelJa: "いちご", emoji: "🍓" },
  { singular: "peach", plural: "peaches", labelJa: "もも", emoji: "🍑" },
];

export const FRUIT_IDS = ["apple", "banana", "orange", "melon", "grape", "strawberry", "peach"] as const;
export type FruitId = (typeof FRUIT_IDS)[number];

export interface TalkContext {
  readonly fruit?: FruitId | null;
}

/** おみせの1ターン目で子どもが選んだ果物を見つけ、2ターン目の「How many ...?」を自然な文脈にする。 */
export const detectChosenFruit = (answer: string): ChosenFruit | null => {
  const { tokens } = classifyUtterance(answer);
  return (
    FRUIT_INFO.find(
      (fruit) => tokens.includes(fruit.singular) || tokens.includes(fruit.plural) || answer.includes(fruit.labelJa),
    ) ?? null
  );
};

interface AdaptableTurn {
  readonly id: string;
  readonly prompt: string;
  readonly promptJa: string;
  readonly visual?: string;
}

/** 選んだ果物に合わせて、おみせの2ターン目の問い(英語・日本語・絵)を差し替える。元のターンは書きかえない。 */
export function adaptTurn<T extends AdaptableTurn>(turn: T, context: TalkContext | undefined): T {
  const fruit = FRUIT_INFO.find(({ singular }) => singular === context?.fruit);
  if (turn.id !== "shop-how-many" || !fruit || fruit.singular === "apple") return turn;
  return {
    ...turn,
    prompt: `How many ${fruit.plural}?`,
    promptJa: `${fruit.labelJa}は いくつ ほしいですか？`,
    visual: `${fruit.emoji}${fruit.emoji}${fruit.emoji}`,
  };
}
