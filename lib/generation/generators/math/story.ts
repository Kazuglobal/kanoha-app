import "server-only";
import { pickOne } from "@/lib/utils/random";
import type { Random } from "../../helpers";

/** へる ときの 動き(その ものに合う言い方)。 */
interface Leaving {
  readonly particle: "を" | "が";
  readonly polite: string;
  readonly plain: string;
  readonly dict: string;
}

/** お話の問題に出す もの(ひらがな・カタカナだけ)と、かぞえかた・言い方。 */
export interface Thing {
  readonly noun: string;
  readonly counter: string;
  /** 「ぜんぶで ○○ですか」の ○○(なんこ・なんぼん など) */
  readonly ask: string;
  readonly exists: "あります" | "います";
  readonly existed: "ありました" | "いました";
  readonly leaving: Leaving;
  /** 「○○を もっています」と言える ものか */
  readonly holdable: boolean;
}

const EAT: Leaving = { particle: "を", polite: "たべました", plain: "たべた", dict: "たべる" };
const USE: Leaving = { particle: "を", polite: "つかいました", plain: "つかった", dict: "つかう" };
const GIVE: Leaving = { particle: "を", polite: "あげました", plain: "あげた", dict: "あげる" };
const FLY: Leaving = { particle: "が", polite: "とんでいきました", plain: "とんでいった", dict: "とんでいく" };
const GO_OUT: Leaving = { particle: "が", polite: "でかけました", plain: "でかけた", dict: "でかける" };

const thing = (noun: string, counter: string, ask: string, leaving: Leaving, extra: Partial<Thing> = {}): Thing => ({
  noun,
  counter,
  ask,
  exists: "あります",
  existed: "ありました",
  leaving,
  holdable: true,
  ...extra,
});

export const THINGS: readonly Thing[] = [
  thing("りんご", "こ", "なんこ", EAT),
  thing("みかん", "こ", "なんこ", EAT),
  thing("いちご", "こ", "なんこ", EAT),
  thing("あめ", "こ", "なんこ", EAT),
  thing("どんぐり", "こ", "なんこ", GIVE),
  thing("ふうせん", "こ", "なんこ", FLY),
  thing("ビーだま", "こ", "なんこ", GIVE),
  thing("えんぴつ", "ほん", "なんぼん", USE),
  thing("シール", "まい", "なんまい", USE),
  thing("おりがみ", "まい", "なんまい", USE),
  thing("ことり", "わ", "なんわ", FLY, { exists: "います", existed: "いました", holdable: false }),
  thing("くるま", "だい", "なんだい", GO_OUT, { holdable: false }),
];

/** さらにのせられる もの(かけ算の「1さらに ○こずつ」用)。 */
export const SERVINGS: readonly Thing[] = THINGS.filter((item) => ["りんご", "みかん", "いちご", "あめ", "どんぐり"].includes(item.noun));

/** ふくろ・はこに入れられる もの(ことり・くるまは入れない)。 */
export const PACKABLE: readonly Thing[] = THINGS.filter((item) => !["ことり", "くるま"].includes(item.noun));

/** 答えにつける「かず + かぞえかた」。 */
export const withCounter = (n: number, item: Thing): string => `${n}${item.counter}`;

/** 「5こを たべる」のように、へらす動きのことば(文の途中で使う)。 */
export const spendPhrase = (item: Thing, n: number): string => `${n}${item.counter}${item.leaving.particle} ${item.leaving.dict}`;

/** あわせる・ふえる お話(a と b をたす)。 */
export function addStory(random: Random, item: Thing, a: number, b: number): string {
  const { noun: n, counter: c, ask, exists } = item;
  const frames = [
    `${n}が ${a}${c} ${exists}。${b}${c} ふえると、ぜんぶで ${ask}ですか。`,
    `あかい ${n}が ${a}${c}、あおい ${n}が ${b}${c} ${exists}。あわせて ${ask}ですか。`,
    ...(item.holdable ? [`${n}を ${a}${c} もっています。${b}${c} もらうと、ぜんぶで ${ask}ですか。`] : []),
  ];
  return pickOne(random, frames);
}

/** のこりをもとめる お話(a から b をひく)。 */
export function subStory(random: Random, item: Thing, a: number, b: number): string {
  const { noun: n, counter: c, ask, exists, existed, leaving } = item;
  return pickOne(random, [
    `${n}が ${a}${c} ${exists}。${b}${c}${leaving.particle} ${leaving.polite}。のこりは ${ask}ですか。`,
    `${a}${c}の ${n}の うち、${b}${c}${leaving.particle} ${leaving.polite}。のこりは ${ask}ですか。`,
    `${n}が ${a}${c} ${existed}。${b}${c}${leaving.particle} ${leaving.polite}。のこりは ${ask}ですか。`,
  ]);
}

/** はじめの数をもとめる お話(ふえて total になった)。 */
export function startAddStory(item: Thing, given: number, total: number): string {
  const { noun: n, counter: c, ask, existed } = item;
  return `${n}が いくつか ${existed}。${given}${c} ふえて、${total}${c}に なりました。はじめは ${ask}でしたか。`;
}

/** はじめの数をもとめる お話(へって rest になった)。 */
export function startSubStory(item: Thing, given: number, rest: number): string {
  const { noun: n, counter: c, ask, existed, leaving } = item;
  return `${n}が いくつか ${existed}。${given}${c}${leaving.particle} ${leaving.plain}ので、${rest}${c}に なりました。はじめは ${ask}でしたか。`;
}
