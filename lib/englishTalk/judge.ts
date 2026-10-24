import type { TalkScene, TalkTurn } from "@/lib/curriculum/englishTalkScenes";

/** クライアントへ渡すシーン(accept / modelAnswer を含めない)。 */
export interface PublicTalkTurn {
  readonly id: string;
  readonly prompt: string;
  readonly promptJa: string;
  readonly answerHintJa: string;
  readonly choices: readonly string[];
  readonly visual?: string;
}

export interface PublicTalkScene {
  readonly id: string;
  readonly title: string;
  readonly titleEn: string;
  readonly description: string;
  readonly emoji: string;
  readonly background: string;
  readonly turns: readonly PublicTalkTurn[];
}

/**
 * 音声認識がカタカナや日本語で返した英語表現を英単語に変換するマップ
 */
const KATAKANA_TO_ENGLISH: readonly [RegExp, string][] = [
  [/マイネームイズ|まいねーむいず/g, " my name is "],
  [/マイネーム|まいねーむ|ネームイズ|ねーむいず/g, " my name is "],
  [/アイムファイン|あいむふぁいん|ファイン|ふぁいん/g, " im fine "],
  [/アイアム|あいあむ|アイム|あいむ/g, " im "],
  [/サンキュー|さんきゅー|サンクス|さんくす/g, " thank you "],
  [/ナイストゥミーチュー|ないすとぅみーちゅー|ナイストゥミートユー|ナイストゥーミーチュー/g, " nice to meet you "],
  [/グッドモーニング|ぐっどもーにんぐ|モーニング|もーにんぐ/g, " good morning "],
  [/グッバイ|ぐっばい|グッドバイ|バイバイ|ばいばい/g, " goodbye "],
  [/シーユー|しーゆー/g, " see you "],
  [/アップル|あっぷる|りんご|リンゴ/g, " apple "],
  [/バナナ|ばなな/g, " banana "],
  [/オレンジ|おれんじ/g, " orange "],
  [/メロン|めろん/g, " melon "],
  [/グレープ|ぐれーぷ|ぶどう/g, " grape "],
  [/ピーチ|ぴーち|もも/g, " peach "],
  [/ストロベリー|すとろべりー|いちご/g, " strawberry "],
  [/ドッグ|どっぐ|ドギー|パピー|いぬ|イヌ|犬/g, " dog "],
  [/エレファント|えれふぁんと|ぞう|ゾウ|象/g, " elephant "],
  [/パンダ|ぱんだ/g, " panda "],
  [/ライオン|らいおん/g, " lion "],
  [/ジラフ|じらふ|きりん|キリン/g, " giraffe "],
  [/モンキー|もんきー|さる|サル|猿/g, " monkey "],
  [/ラビット|らびっと|うさぎ|ウサギ/g, " rabbit "],
  [/タイガー|たいがー|とら|トラ|虎/g, " tiger "],
  [/キャット|きゃっと/g, " cat "],
  [/ペンシル|ぺんしる|えんぴつ|鉛筆/g, " pencil "],
  [/レッド|れっど|あかいろ|赤色/g, " red "],
  [/グッド|ぐっど/g, " good "],
  [/グレート|ぐれーと/g, " great "],
  [/ハッピー|はっぴー/g, " happy "],
  [/スリーピー|すりーぴー|ねむい|眠い/g, " sleepy "],
  [/ハングリー|はんぐりー|おなかすいた/g, " hungry "],
  [/タイアード|たいあーど|つかれた|疲れた/g, " tired "],
  [/シュア|しゅあ/g, " sure "],
  [/コールミー|こーるみー/g, " call me "],
  [/ビッグ|びっぐ|おおきい|大きい/g, " big "],
  [/オーケー|おーけー|オッケー|おっけー/g, " ok "],
  [/イエス|いえす|イェス|ヤー|やー/g, " yes "],
  [/ノー|のー/g, " no "],
  [/レッツ|れっつ/g, " lets "],
  [/ワン|わん/g, " one "],
  [/ツー|つー/g, " two "],
  [/スリー|すりー/g, " three "],
  [/フォー|ふぉー/g, " four "],
  [/ファイブ|ふぁいぶ/g, " five "],
  [/シックス|しっくす/g, " six "],
  [/セブン|せぶん/g, " seven "],
  [/エイト|えいと/g, " eight "],
  [/ナイン|ないん/g, " nine "],
  [/テン|てん/g, " ten "],
  [/ハロー|はろー/g, " hello "],
  [/ハイ|はい/g, " hi "],
];

/**
 * 日本人の英語発音で Web Speech API (en-US) がよく誤変換する同音・近似語
 */
const SPOKEN_PHONETIC_ALIASES: Readonly<Record<string, readonly string[]>> = {
  one: ["won"],
  two: ["to", "too", "tu"],
  three: ["tree", "free", "sri", "thee"],
  four: ["for", "fore"],
  seven: ["heaven", "saving"],
  eight: ["ate"],
  dog: ["dock", "dug", "dawg", "dark", "dogs"],
  red: ["read", "led", "let", "bed"],
  fine: ["find", "vine", "pine"],
  pencil: ["cancel", "pencils", "pens"],
  elephant: ["eleven", "element", "elephants"],
  morning: ["warning"],
  thank: ["tank", "sank"],
  goodbye: ["good by", "bye bye", "byebye"],
  lets: ["let us", "less"],
};

/** 小文字化・アポストロフィ除去・記号除去・空白の正規化。 */
export const normalizeEnglish = (text: string): string =>
  text
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** カタカナ発音も含めて英語トークンに正規化する。 */
export const normalizeSpokenEnglish = (text: string): string => {
  let converted = text;
  for (const [pattern, replacement] of KATAKANA_TO_ENGLISH) {
    converted = converted.replace(pattern, replacement);
  }
  return normalizeEnglish(converted);
};

const containsPhrase = (normalized: string, phrase: string): boolean => {
  const target = normalizeEnglish(phrase);
  if (` ${normalized} `.includes(` ${target} `)) return true;
  const aliases = SPOKEN_PHONETIC_ALIASES[target];
  if (aliases) {
    return aliases.some((alias) => ` ${normalized} `.includes(` ${normalizeEnglish(alias)} `));
  }
  return false;
};

const DONT_KNOW_ENGLISH_PHRASES = [
  "i dont know",
  "dont know",
  "do not know",
  "i do not know",
  "dunno",
  "no idea",
  "i have no idea",
  "not sure",
  "im not sure",
  "i am not sure",
  "i dont understand",
  "dont understand",
  "do not understand",
  "i do not understand",
  "cant understand",
  "cannot understand",
  "what does it mean",
  "what does that mean",
  "what do you mean",
  "help me",
  "in japanese",
  "japanese please",
  "speak japanese",
  "wakaranai",
  "wakarimasen",
  "wakannai",
  "waka ranai",
  "walk around night",
  "walk around i",
  "what got a night",
  "what can i night",
  "what car a night",
  "water a night",
  "wanna cry night",
  "work around night",
  "what color night",
] as const;

const DONT_KNOW_SINGLE_WORDS = new Set([
  "help",
  "hint",
  "japanese",
  "pardon",
  "huh",
  "what",
]);

const DONT_KNOW_JAPANESE_PATTERNS = [
  "わからない",
  "わかんない",
  "分からない",
  "分かんない",
  "わかりません",
  "分かりません",
  "しらない",
  "知らない",
  "しりません",
  "知りません",
  "どういう意味",
  "どういういみ",
  "どういうこと",
  "日本語",
  "にほんご",
  "ヒント",
  "おしえて",
  "教えて",
  "むずかしい",
  "難しい",
] as const;

/**
 * 「I don't know」「わからない」などの発話を判定する。
 * 不正解にはせず、日本語の聞きなおしとヒントを出すために使う。
 */
export const isDontKnowAnswer = (answer: string): boolean => {
  const raw = answer.trim();
  if (!raw) return false;
  for (const jp of DONT_KNOW_JAPANESE_PATTERNS) {
    if (raw.includes(jp)) return true;
  }
  const normalized = normalizeEnglish(raw);
  if (!normalized) return false;
  if (DONT_KNOW_SINGLE_WORDS.has(normalized)) return true;
  return DONT_KNOW_ENGLISH_PHRASES.some((phrase) => ` ${normalized} `.includes(` ${phrase} `));
};

/** まちがえたときにすぐ英語で伝える正しいフィードバック文を組み立てる。 */
export const buildCorrectiveFeedbackEn = (
  turnOrModelAnswer: Pick<TalkTurn, "modelAnswer" | "feedbackEn"> | string,
  explicitFeedbackEn?: string,
): string => {
  if (explicitFeedbackEn?.trim()) return explicitFeedbackEn.trim();
  if (typeof turnOrModelAnswer === "string") {
    const model = turnOrModelAnswer.trim();
    return model ? `Nice try! Say: ${model}` : "Nice try! Let's try again.";
  }
  if (turnOrModelAnswer.feedbackEn?.trim()) {
    return turnOrModelAnswer.feedbackEn.trim();
  }
  return `Nice try! Say: ${turnOrModelAnswer.modelAnswer}`;
};

const NON_NAME_WORDS = new Set([
  "fine", "good", "great", "happy", "ok", "okay", "hungry", "sleepy", "tired", "sad",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "here", "ready", "sorry", "sure", "not", "dont", "do", "a", "an", "the", "sunny",
  "apples", "apple", "cat", "dog", "goodbye", "bye",
]);

/** キーワード群をすべて満たせば正解(音声認識の言いまわしの揺れ・カタカナ発音を許す)。 */
export const judgeTalkAnswer = (turn: TalkTurn, answer: string): boolean => {
  if (isDontKnowAnswer(answer)) return false;
  const normalized = normalizeSpokenEnglish(answer);
  if (!normalized) return false;

  if (turn.accept.every((group) => group.some((phrase) => containsPhrase(normalized, phrase)))) {
    return true;
  }

  // 「What's your name?」では「I'm Sora.」「Hello, I'm Ken.」「My name's Yuki.」「I'm ゆうき」も正解として受け入れる
  if (turn.id === "greeting-name") {
    if (containsPhrase(normalized, "my names") || containsPhrase(normalized, "mine name")) return true;
    const imMatch = normalized.match(/(?:^|\s)(?:im|i am|my name)\s+([a-z]{2,20})(?:\s|$)/);
    if (imMatch && !NON_NAME_WORDS.has(imMatch[1])) {
      return true;
    }
    // 「I'm ゆうき」「アイム たろう」のように日本語の名前が続いている場合も受け入れる
    if (/(?:i'm|i\s+am|my\s+name|アイム|あいむ|マイネーム|まいねーむ)\s*[ぁ-んァ-ヶ一-龠々ー]{1,12}/i.test(answer)) {
      return true;
    }
  }

  return false;
};

const hash = (text: string): number =>
  [...text].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);

/** turn id から決まる並び(サーバー描画とクライアントで同じ順になる)。 */
const shuffleChoices = (turn: TalkTurn): readonly string[] =>
  [...turn.choices]
    .map((choice) => ({ choice, key: hash(`${turn.id}:${choice}`) }))
    .sort((a, b) => a.key - b.key)
    .map(({ choice }) => choice);

export const toPublicScene = (scene: TalkScene): PublicTalkScene => ({
  id: scene.id,
  title: scene.title,
  titleEn: scene.titleEn,
  description: scene.description,
  emoji: scene.emoji,
  background: scene.background,
  turns: scene.turns.map((turn) => ({
    id: turn.id,
    prompt: turn.prompt,
    promptJa: turn.promptJa,
    answerHintJa: turn.answerHintJa,
    choices: shuffleChoices(turn),
    ...(turn.visual ? { visual: turn.visual } : {}),
  })),
});


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

/** おみせの1ターン目で子どもが選んだ果物を検出し、2ターン目の「How many ...?」を自然な文脈にする。 */
export const detectChosenFruit = (answer: string): ChosenFruit | null => {
  const norm = normalizeSpokenEnglish(answer);
  if (!norm) return null;
  for (const fruit of FRUIT_INFO) {
    if (containsPhrase(norm, fruit.singular) || containsPhrase(norm, fruit.plural)) {
      return fruit;
    }
  }
  return null;
};
