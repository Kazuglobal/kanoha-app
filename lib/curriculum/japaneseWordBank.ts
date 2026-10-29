import "server-only";

/**
 * 国語の「ことばのきまり」の問題を自動生成するための ことば表(ひらがな・カタカナだけ)。
 * 答えが 1 つにきまるように、まぎらわしい組み合わせ(同じ意味に近い はんたいの ことばなど)は入れない。
 */

/** はんたいの意味の ことば。cluster が同じ組は 意味が近いので、まちがいの選択肢にいっしょに出さない。 */
export interface AntonymPair {
  readonly a: string;
  readonly b: string;
  readonly kind: "adjective" | "position" | "verb";
  readonly cluster: string;
}

const pair = (kind: AntonymPair["kind"], cluster: string, a: string, b: string): AntonymPair => ({ kind, cluster, a, b });

export const ANTONYMS: readonly AntonymPair[] = [
  pair("adjective", "size", "おおきい", "ちいさい"),
  pair("adjective", "size", "ひろい", "せまい"),
  pair("adjective", "size", "ふとい", "ほそい"),
  pair("adjective", "size", "ながい", "みじかい"),
  pair("adjective", "size", "たかい", "ひくい"),
  pair("adjective", "weight", "おもい", "かるい"),
  pair("adjective", "light", "あかるい", "くらい"),
  pair("adjective", "age", "あたらしい", "ふるい"),
  pair("adjective", "strength", "つよい", "よわい"),
  pair("adjective", "amount", "おおい", "すくない"),
  pair("adjective", "distance", "ちかい", "とおい"),
  pair("adjective", "feeling", "うれしい", "かなしい"),
  pair("adjective", "speed", "はやい", "おそい"),
  pair("position", "vertical", "うえ", "した"),
  pair("position", "depth", "まえ", "うしろ"),
  pair("position", "side", "みぎ", "ひだり"),
  pair("verb", "go", "いく", "くる"),
  pair("verb", "enter", "はいる", "でる"),
  pair("verb", "door", "あける", "しめる"),
  pair("verb", "wake", "おきる", "ねる"),
  pair("verb", "game", "かつ", "まける"),
  pair("verb", "trade", "かう", "うる"),
  pair("verb", "climb", "のぼる", "おりる"),
];

/** なかま分け(分類の名前と、その なかまの ことば)。 */
export interface WordCategory {
  readonly id: string;
  readonly label: string;
  readonly words: readonly string[];
}

export const WORD_CATEGORIES: readonly WordCategory[] = [
  { id: "animal", label: "どうぶつ", words: ["いぬ", "ねこ", "うさぎ", "さる", "くま", "うま", "ぞう", "ライオン"] },
  { id: "fruit", label: "くだもの", words: ["りんご", "みかん", "ぶどう", "バナナ", "さくらんぼ", "パイナップル", "キウイ"] },
  { id: "vegetable", label: "やさい", words: ["にんじん", "だいこん", "きゅうり", "なす", "ねぎ", "たまねぎ", "じゃがいも"] },
  { id: "vehicle", label: "のりもの", words: ["くるま", "でんしゃ", "ひこうき", "ふね", "バス", "じてんしゃ"] },
  { id: "body", label: "からだ", words: ["あたま", "て", "あし", "め", "みみ", "はな", "くち"] },
  { id: "color", label: "いろ", words: ["あか", "あお", "きいろ", "みどり", "しろ", "くろ"] },
  { id: "season", label: "きせつ", words: ["はる", "なつ", "あき", "ふゆ"] },
  { id: "instrument", label: "がっき", words: ["ピアノ", "たいこ", "ふえ", "ギター", "カスタネット"] },
  { id: "stationery", label: "ぶんぼうぐ", words: ["えんぴつ", "けしゴム", "ノート", "はさみ", "のり", "じょうぎ"] },
];

/** ようすや おとを あらわす ことば。なきごえ・おとはカタカナ、ようすはひらがなで書く。cluster が同じ語は 意味が近いので、まちがいにいっしょに出さない。 */
export interface Onomatopoeia {
  readonly word: string;
  readonly scene: string;
  readonly kind: "animal" | "weather" | "manner" | "feeling";
  readonly cluster?: string;
}

const sound = (kind: Onomatopoeia["kind"], word: string, scene: string, cluster?: string): Onomatopoeia => ({
  kind,
  word,
  scene,
  ...(cluster ? { cluster } : {}),
});

export const ONOMATOPOEIA: readonly Onomatopoeia[] = [
  sound("animal", "ワンワン", "いぬの なきごえ"),
  sound("animal", "ニャーニャー", "ねこの なきごえ"),
  sound("animal", "ピヨピヨ", "ひよこの なきごえ"),
  sound("animal", "モーモー", "うしの なきごえ"),
  sound("animal", "ブーブー", "ぶたの なきごえ"),
  sound("weather", "ザーザー", "あめが つよく ふる おと"),
  sound("weather", "しとしと", "あめが しずかに ふる ようす"),
  sound("weather", "ゴロゴロ", "とおくで かみなりが なる おと", "roll"),
  sound("weather", "ビュービュー", "かぜが つよく ふく おと"),
  sound("weather", "ぽかぽか", "おひさまで あたたかい ようす"),
  sound("manner", "ふわふわ", "やわらかくて かるい ようす"),
  sound("manner", "ぴょんぴょん", "うさぎが はねる ようす"),
  sound("manner", "のろのろ", "とても ゆっくり すすむ ようす"),
  sound("manner", "ころころ", "まるい ものが ころがる ようす", "roll"),
  sound("manner", "ぐるぐる", "おなじ ところを なんども まわる ようす", "roll"),
  sound("manner", "きらきら", "ほしが かがやく ようす"),
  sound("feeling", "にこにこ", "うれしくて わらっている ようす"),
  sound("feeling", "どきどき", "むねが はやく うごく ようす"),
  sound("feeling", "ぺこぺこ", "おなかが すいた ようす"),
  sound("feeling", "しくしく", "かなしくて ないている ようす"),
  sound("feeling", "ぷんぷん", "おこっている ようす"),
  sound("feeling", "すやすや", "きもちよく ねている ようす"),
];

/** カタカナで書くことばと、その ひらがな。 */
export interface Loanword {
  readonly katakana: string;
  readonly hiragana: string;
}

const loan = (katakana: string, hiragana: string): Loanword => ({ katakana, hiragana });

export const LOANWORDS: readonly Loanword[] = [
  loan("パン", "ぱん"), loan("ペン", "ぺん"), loan("バス", "ばす"), loan("ドア", "どあ"), loan("ボール", "ぼーる"),
  loan("ノート", "のーと"), loan("ケーキ", "けーき"), loan("テレビ", "てれび"), loan("スープ", "すーぷ"), loan("ピアノ", "ぴあの"),
  loan("ミルク", "みるく"), loan("カレー", "かれー"), loan("ライオン", "らいおん"), loan("サッカー", "さっかー"), loan("コップ", "こっぷ"),
  loan("ベッド", "べっど"), loan("ギター", "ぎたー"), loan("バナナ", "ばなな"), loan("ジュース", "じゅーす"), loan("シャツ", "しゃつ"),
  loan("ジャム", "じゃむ"), loan("ランドセル", "らんどせる"), loan("キャベツ", "きゃべつ"),
];

/** ふつう ひらがなで書く ことば(「カタカナで書くことばは どれ?」の まちがい)。 */
export const NATIVE_WORDS: readonly string[] = [
  "やま", "かわ", "ごはん", "さかな", "はな", "ほん", "いぬ", "くるま", "えんぴつ", "おにぎり",
  "たまご", "みず", "つくえ", "いす", "まど", "うみ", "そら", "ほし", "てがみ", "うた",
];
