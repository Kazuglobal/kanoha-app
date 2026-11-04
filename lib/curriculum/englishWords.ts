import "server-only";

/**
 * 英語の問題の自動生成に使う単語表(2年生向け)。
 * - en は ASCII だけ(聞く・えらぶ中心。英単語にカタカナの読みは付けない)
 * - emoji はぜんぶの語に付ける(絵で選ぶ問題用)。ja は 昔からのひらがなの言い方があるときだけ
 * - level: 1 = いちばんなじみのある語、3 = すこし むずかしい語
 */

export type WordCategory = "animal" | "color" | "fruit" | "food" | "body" | "number";

export interface EnglishWord {
  readonly en: string;
  readonly emoji: string;
  /** ひらがなの意味(カタカナの外来語しかない語には付けない) */
  readonly ja?: string;
  readonly category: WordCategory;
  readonly level: 1 | 2 | 3;
}

const word = (category: WordCategory, level: 1 | 2 | 3, en: string, emoji: string, ja?: string): EnglishWord => ({
  category,
  level,
  en,
  emoji,
  ...(ja ? { ja } : {}),
});

const animal = (level: 1 | 2 | 3, en: string, emoji: string, ja?: string) => word("animal", level, en, emoji, ja);
const color = (level: 1 | 2 | 3, en: string, emoji: string, ja?: string) => word("color", level, en, emoji, ja);
const fruit = (level: 1 | 2 | 3, en: string, emoji: string, ja?: string) => word("fruit", level, en, emoji, ja);
const food = (level: 1 | 2 | 3, en: string, emoji: string, ja?: string) => word("food", level, en, emoji, ja);
const body = (level: 1 | 2 | 3, en: string, emoji: string, ja: string) => word("body", level, en, emoji, ja);

export const ENGLISH_WORDS: readonly EnglishWord[] = [
  animal(1, "dog", "🐶", "いぬ"),
  animal(1, "cat", "🐱", "ねこ"),
  animal(1, "bird", "🐦", "とり"),
  animal(1, "fish", "🐟", "さかな"),
  animal(1, "rabbit", "🐰", "うさぎ"),
  animal(2, "pig", "🐷", "ぶた"),
  animal(2, "cow", "🐮", "うし"),
  animal(2, "horse", "🐴", "うま"),
  animal(2, "monkey", "🐵", "さる"),
  animal(2, "bear", "🐻", "くま"),
  animal(3, "elephant", "🐘", "ぞう"),
  animal(3, "lion", "🦁"),
  animal(3, "tiger", "🐯", "とら"),
  animal(3, "frog", "🐸", "かえる"),
  animal(3, "snake", "🐍", "へび"),
  animal(3, "sheep", "🐑", "ひつじ"),
  animal(3, "mouse", "🐭", "ねずみ"),
  animal(3, "giraffe", "🦒"),

  color(1, "red", "🔴", "あか"),
  color(1, "blue", "🔵", "あお"),
  color(1, "yellow", "🟡", "きいろ"),
  color(1, "green", "🟢", "みどり"),
  color(2, "black", "⚫", "くろ"),
  color(2, "white", "⚪", "しろ"),
  color(2, "brown", "🟤", "ちゃいろ"),
  color(3, "purple", "🟣", "むらさき"),
  color(3, "orange", "🟠"),

  fruit(1, "apple", "🍎", "りんご"),
  fruit(1, "banana", "🍌"),
  fruit(1, "grape", "🍇", "ぶどう"),
  fruit(1, "strawberry", "🍓", "いちご"),
  fruit(2, "lemon", "🍋"),
  fruit(2, "peach", "🍑", "もも"),
  fruit(2, "watermelon", "🍉", "すいか"),
  fruit(3, "cherry", "🍒", "さくらんぼ"),
  fruit(3, "melon", "🍈"),
  fruit(3, "pineapple", "🍍"),

  food(1, "bread", "🍞"),
  food(1, "egg", "🥚", "たまご"),
  food(1, "milk", "🥛", "ぎゅうにゅう"),
  food(1, "rice", "🍚", "ごはん"),
  food(2, "cake", "🍰"),
  food(2, "pizza", "🍕"),
  food(2, "cookie", "🍪"),
  food(2, "tomato", "🍅"),
  food(3, "potato", "🥔", "じゃがいも"),
  food(3, "carrot", "🥕"),
  food(3, "corn", "🌽", "とうもろこし"),
  food(3, "hamburger", "🍔"),

  body(1, "eye", "👁️", "め"),
  body(1, "ear", "👂", "みみ"),
  body(1, "nose", "👃", "はな"),
  body(1, "mouth", "👄", "くち"),
  body(2, "hand", "✋", "て"),
  body(2, "foot", "🦶", "あし"),
  body(3, "arm", "💪", "うで"),
  body(3, "tooth", "🦷", "は"),
];

const NUMBER_WORDS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
] as const;

/** 1〜20 の数(emoji の欄には けたの数字を入れる。ja も数字)。 */
export const ENGLISH_NUMBERS: readonly EnglishWord[] = NUMBER_WORDS.map((en, index) => ({
  category: "number",
  level: index < 5 ? 1 : index < 10 ? 2 : 3,
  en,
  emoji: String(index + 1),
  ja: String(index + 1),
}));

/** アルファベットの 大文字・小文字 と、まぎらわしい字の 組。 */
export const UPPERCASE = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"] as const;
export const LOWERCASE = [..."abcdefghijklmnopqrstuvwxyz"] as const;
export const LOOKALIKES: readonly (readonly string[])[] = [
  ["b", "d", "p", "q"],
  ["B", "D", "P", "R"],
  ["m", "n", "w", "u"],
  ["M", "N", "W", "V"],
  ["c", "e", "o", "a"],
  ["C", "G", "O", "Q"],
  ["E", "F", "L", "I"],
  ["i", "j", "l", "t"],
  ["f", "t", "k", "h"],
  ["S", "Z", "X", "K"],
  ["g", "q", "y", "j"],
  ["s", "z", "x", "v"],
  ["T", "Y", "H", "J"],
  ["r", "n", "h", "k"],
];

export interface Greeting {
  readonly en: string;
  readonly ja: string;
  /** 同じ組の 2 つは、場面によっては どちらも使える(まぎらわしいので、選択肢にいっしょに出さない) */
  readonly group: string;
  /** その あいさつを つかう場面(ひらがなだけ) */
  readonly situation: string;
  readonly emoji?: string;
  /** その あいさつへの へんじ(ある語だけ) */
  readonly reply?: string;
  /** へんじをえらぶ問題の、まちがいの選択肢(ぜったいに へんじにならない文) */
  readonly wrongReplies?: readonly string[];
}

/** 朝・昼・夕・夜の あいさつ。 */
export const GREETINGS: readonly Greeting[] = [
  { en: "Good morning.", ja: "おはよう", group: "time", situation: "あさ おきたとき", emoji: "🌅" },
  { en: "Good afternoon.", ja: "こんにちは", group: "time", situation: "ひるすぎに おそとで あったとき", emoji: "☀️" },
  { en: "Good evening.", ja: "こんばんは", group: "time", situation: "ばんごはんの ころ、おそとで あったとき", emoji: "🌆" },
  { en: "Good night.", ja: "おやすみなさい", group: "time", situation: "ねる まえ", emoji: "😴" },
];

/** おれい・おわびなど、ていねいな ことば。 */
export const POLITE_PHRASES: readonly Greeting[] = [
  { en: "Thank you.", ja: "ありがとう", group: "thanks", situation: "おくりものを もらったとき", reply: "You're welcome.", wrongReplies: ["It's OK.", "Good morning.", "I'm fine, thank you.", "My name is Ken."] },
  { en: "You're welcome.", ja: "どういたしまして", group: "thanks", situation: "ありがとうと いわれたとき" },
  { en: "Sorry.", ja: "ごめんなさい", group: "sorry", situation: "ぶつかって しまったとき", reply: "It's OK.", wrongReplies: ["You're welcome.", "Good morning.", "I'm fine, thank you.", "Here you are."] },
  { en: "Please.", ja: "おねがいします", group: "please", situation: "おねがいを するとき" },
  { en: "Here you are.", ja: "どうぞ", group: "give", situation: "ものを わたすとき", reply: "Thank you.", wrongReplies: ["It's OK.", "Good morning.", "I'm fine, thank you.", "My name is Ken."] },
  { en: "Goodbye.", ja: "さようなら", group: "bye", situation: "さよならを いうとき" },
  { en: "See you.", ja: "またね", group: "bye", situation: "あしたも あう ともだちと わかれるとき" },
];

/** 名前をつたえる あいさつ用: 名前の候補。 */
export const NAMES = ["Ken", "Mika", "Sora", "Ren", "Yuki", "Aki", "Mio", "Hana"] as const;
