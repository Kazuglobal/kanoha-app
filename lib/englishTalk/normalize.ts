/**
 * えいごで おはなしの聞き取り結果(声・文字)を、判定しやすい形にそろえる純粋関数。
 * 音声認識(ja-JP)は英語の発音をカタカナで返すことがあるので、カタカナの外来語は英語に直す。
 * 日本語の「意味」は訳さない(「いぬ」を dog と読み替えると、日本語だけの答えが正解になってしまう)。
 */

/** カタカナ・ひらがなの発音表記 → 英語。長い表記を先に書く(短い表記が先に当たらないように)。 */
const LOANWORDS: readonly (readonly [readonly string[], string])[] = [
  [["マイネームイズ", "まいねーむいず"], "my name is"],
  [["マイネーム", "まいねーむ", "ネームイズ", "ねーむいず"], "my name is"],
  [["アイムファイン", "あいむふぁいん", "ファイン", "ふぁいん"], "im fine"],
  [["アイアム", "あいあむ", "アイム", "あいむ"], "im"],
  [["サンキュー", "さんきゅー", "サンクス", "さんくす"], "thank you"],
  [["ナイストゥミーチュー", "ないすとぅみーちゅー", "ナイストゥミートユー", "ナイストゥーミーチュー"], "nice to meet you"],
  [["グッドモーニング", "ぐっどもーにんぐ", "モーニング", "もーにんぐ"], "good morning"],
  [["グッバイ", "ぐっばい", "グッドバイ", "バイバイ", "ばいばい"], "goodbye"],
  [["シーユー", "しーゆー"], "see you"],
  [["アップル", "あっぷる"], "apple"],
  [["バナナ", "ばなな"], "banana"],
  [["オレンジ", "おれんじ"], "orange"],
  [["メロン", "めろん"], "melon"],
  [["グレープ", "ぐれーぷ"], "grape"],
  [["ピーチ", "ぴーち"], "peach"],
  [["ストロベリー", "すとろべりー"], "strawberry"],
  [["ドッグ", "どっぐ", "ドギー", "パピー"], "dog"],
  [["エレファント", "えれふぁんと"], "elephant"],
  [["パンダ", "ぱんだ"], "panda"],
  [["ライオン", "らいおん"], "lion"],
  [["ジラフ", "じらふ"], "giraffe"],
  [["モンキー", "もんきー"], "monkey"],
  [["ラビット", "らびっと"], "rabbit"],
  [["タイガー", "たいがー"], "tiger"],
  [["キャット", "きゃっと"], "cat"],
  [["ペンシル", "ぺんしる"], "pencil"],
  [["レッド", "れっど"], "red"],
  [["グッド", "ぐっど"], "good"],
  [["グレート", "ぐれーと"], "great"],
  [["ハッピー", "はっぴー"], "happy"],
  [["スリーピー", "すりーぴー"], "sleepy"],
  [["ハングリー", "はんぐりー"], "hungry"],
  [["タイアード", "たいあーど"], "tired"],
  [["シュア", "しゅあ"], "sure"],
  [["コールミー", "こーるみー"], "call me"],
  [["ビッグ", "びっぐ"], "big"],
  [["オーケー", "おーけー", "オッケー", "おっけー"], "ok"],
  [["イエス", "いえす", "イェス", "ヤー"], "yes"],
  [["ノー", "のー"], "no"],
  [["レッツ", "れっつ"], "lets"],
  [["ワン"], "one"],
  [["ツー", "つー"], "two"],
  [["スリー", "すりー"], "three"],
  [["フォー", "ふぉー"], "four"],
  [["ファイブ", "ふぁいぶ"], "five"],
  [["シックス", "しっくす"], "six"],
  [["セブン", "せぶん"], "seven"],
  [["エイト", "えいと"], "eight"],
  [["ナイン", "ないん"], "nine"],
  [["テン"], "ten"],
  [["ハロー", "はろー"], "hello"],
  [["ハイ"], "hi"],
];

/** かな・カタカナ・長音(ー)。短いカタカナ語は、この一続きの中の一部のときは英語にしない(ワンちゃん・ノート・テント)。 */
const KANA_RUN = "ぁ-んァ-ヶー";
const SHORT_LOANWORD_LENGTH = 3;

const LOANWORD_RULES: readonly (readonly [RegExp, string])[] = LOANWORDS.map(([patterns, english]) => {
  const alternatives = [...patterns].sort((a, b) => b.length - a.length).join("|");
  const isShort = Math.max(...patterns.map((pattern) => pattern.length)) <= SHORT_LOANWORD_LENGTH;
  return isShort
    ? [new RegExp(`(^|[^${KANA_RUN}])(?:${alternatives})(?![${KANA_RUN}])`, "g"), `$1 ${english} `]
    : [new RegExp(alternatives, "g"), ` ${english} `];
});

const JAPANESE_CHAR = /[぀-ヿ一-鿿々]/;
const LATIN_LETTER = /[A-Za-z]/;
/** 書き起こしの印((inaudible)・[no speech]・（音楽）など)。話した言葉ではない。 */
const TRANSCRIPT_MARKS = /\([^)]*\)|\[[^\]]*\]|（[^）]*）|［[^］]*］/g;

/** 全角・半角のそろえ、書き起こしの印の除去、小文字化・アポストロフィ除去・記号除去・空白の正規化。 */
export const normalizeEnglish = (text: string): string =>
  text
    .normalize("NFKC")
    .replace(TRANSCRIPT_MARKS, " ")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const convertLoanwords = (text: string): string =>
  LOANWORD_RULES.reduce((converted, [pattern, english]) => converted.replace(pattern, english), text.normalize("NFKC"));

/** カタカナ発音も含めて英語のトークン列(空白区切りの文字列)に正規化する。 */
export const normalizeSpokenEnglish = (text: string): string => normalizeEnglish(convertLoanwords(text));

export const tokenize = (normalized: string): string[] => (normalized ? normalized.split(" ") : []);

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] as const;

/** 縮めた言い方は、ひらいた形にそろえる(音声認識は I'm / I am、It's / It is のどちらでも書く)。 */
const EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
  im: ["i", "am"],
  its: ["it", "is"],
  names: ["name", "is"],
  thats: ["that", "is"],
  whats: ["what", "is"],
  heres: ["here", "is"],
  theres: ["there", "is"],
  youre: ["you", "are"],
};

/**
 * 判定のためにトークンをそろえる: 数字(0〜10)は英単語に、縮めた言い方はひらいた形に。
 * 音声認識は「seven」を「7」と書くことがあり、お手本・accept の側も同じようにそろえて比べる。
 */
export const canonicalize = (tokens: readonly string[]): string[] =>
  tokens.flatMap((token) => {
    if (/^(?:0|[1-9]\d*)$/.test(token) && Number(token) < NUMBER_WORDS.length) return [NUMBER_WORDS[Number(token)]];
    return EXPANSIONS[token] ?? [token];
  });

export type UtteranceKind = "english" | "loanword" | "mixed" | "japanese" | "empty";

export interface Utterance {
  kind: UtteranceKind;
  tokens: string[];
}

/**
 * 発話を見分ける(カタカナの外来語は英語に直したあとで見る)。
 * - english : 英語の文字があり、日本語は残らない
 * - loanword: 英語の文字はないが、カタカナの外来語や数字だけで、英語にできた
 * - mixed   : 英語の文字があり、英語にできなかった日本語も残っている
 * - japanese: 英語にできない日本語が残り、英語の文字がない(「7歳」「3こ」のように数字がまじっていても日本語)
 * - empty   : 話した言葉がない(記号だけ・書き起こしの印だけ)
 */
export function classifyUtterance(text: string): Utterance {
  const converted = convertLoanwords(text);
  const tokens = tokenize(normalizeEnglish(converted));
  const leftoverJapanese = JAPANESE_CHAR.test(converted.replace(TRANSCRIPT_MARKS, " "));
  const hadLetters = LATIN_LETTER.test(text.normalize("NFKC").replace(TRANSCRIPT_MARKS, " "));

  if (tokens.length === 0) return { kind: leftoverJapanese ? "japanese" : "empty", tokens: [] };
  if (leftoverJapanese) return { kind: hadLetters ? "mixed" : "japanese", tokens };
  return { kind: hadLetters ? "english" : "loanword", tokens };
}
