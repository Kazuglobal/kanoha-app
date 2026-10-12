/**
 * えいごで おはなし(英会話れんしゅう)のシーン定義。
 * 背景は public/scenes/*.svg のテンプレ画像(生成コストなし)。
 * accept は「声のこたえ」を判定するキーワード群で、サーバーだけが読む(クライアントへ渡さない)。
 * 各グループのどれか1つが含まれれば合格。すべてのグループを満たすと正解。
 * アポストロフィは判定前に取り除くので、ここにも付けない(I'm → im)。
 */

export interface TalkTurn {
  readonly id: string;
  /** さゆきちゃんが英語で話すセリフ */
  readonly prompt: string;
  /** 英語が分からないときに日本語で聞きなおすセリフ */
  readonly promptJa: string;
  /** こたえかたのヒント(日本語) */
  readonly answerHintJa: string;
  /** まちがえたときに教える正しい言い方 */
  readonly modelAnswer: string;
  /** 正しい言い方の日本語の意味 */
  readonly modelAnswerJa: string;
  /** 4択(正解1つ + まちがい3つ)。表示順はシャッフルする */
  readonly choices: readonly [string, string, string, string];
  readonly accept: readonly (readonly string[])[];
  /** シーンの中で注目させるもの(絵文字) */
  readonly visual?: string;
}

export interface TalkScene {
  readonly id: string;
  readonly title: string;
  readonly titleEn: string;
  readonly description: string;
  readonly emoji: string;
  readonly background: string;
  readonly turns: readonly TalkTurn[];
}

const NUMBERS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
] as const;

const FRUITS = [
  "apple", "apples", "banana", "bananas", "orange", "oranges", "melon", "melons",
  "grape", "grapes", "strawberry", "strawberries", "peach", "peaches", "tomato", "tomatoes",
] as const;

const ANIMALS = [
  "panda", "pandas", "lion", "lions", "elephant", "elephants", "giraffe", "giraffes",
  "monkey", "monkeys", "rabbit", "rabbits", "dog", "dogs", "cat", "cats", "tiger", "tigers",
] as const;

const BYE = ["goodbye", "good bye", "bye", "see you"] as const;

const greeting: TalkScene = {
  id: "greeting",
  title: "あいさつと てんき",
  titleEn: "Hello! How's the weather?",
  description: "あさの こうえんで さゆきちゃんと あいさつして、てんきの おはなしを しよう",
  emoji: "👋",
  background: "/scenes/greeting.svg",
  turns: [
    {
      id: "greeting-name",
      prompt: "Hello! I'm Sayuki. What's your name?",
      promptJa: "こんにちは！わたしは さゆき。あなたの おなまえは なあに？",
      answerHintJa: "「My name is 〇〇.」で なまえを いってみよう",
      modelAnswer: "My name is Yuki.",
      modelAnswerJa: "わたしの なまえは ゆきです。",
      choices: ["My name is Yuki.", "I like apples.", "It's sunny.", "Goodbye!"],
      // 「I'm fine」などを名前と取りちがえないよう、名前を言う言い方だけをキーワードにする。
      // 「I'm Yuki.」のような答えは、ログイン中なら AI 判定がひろう
      accept: [["my name is", "name is", "call me"]],
      visual: "🙂",
    },
    {
      id: "greeting-how-are-you",
      prompt: "How are you today?",
      promptJa: "きょうの ごきげんは どう？",
      answerHintJa: "げんきなら「I'm fine, thank you.」や「I'm great.」って いうよ",
      modelAnswer: "I'm fine, thank you.",
      modelAnswerJa: "げんきだよ、ありがとう。",
      choices: ["I'm fine, thank you.", "I'm ten.", "It's a cat.", "See you."],
      accept: [["fine", "good", "great", "happy", "ok", "okay", "sleepy", "hungry", "tired"]],
      visual: "😊",
    },
    {
      id: "greeting-age",
      prompt: "How's the weather today?",
      promptJa: "きょうの てんきは どうかな？（はれ☀️だよ）",
      answerHintJa: "はれなら「It's sunny.」って いうよ",
      modelAnswer: "It's sunny.",
      modelAnswerJa: "はれです。",
      choices: ["It's sunny.", "I'm fine.", "It's blue.", "Thank you."],
      accept: [["sunny", "rainy", "cloudy", "snowy", "ten", ...NUMBERS]],
      visual: "☀️",
    },
    {
      id: "greeting-nice",
      prompt: "Nice to meet you!",
      promptJa: "あえて うれしいな！ よろしくね！",
      answerHintJa: "「Nice to meet you, too.」で 「わたしも うれしい」って いえるよ",
      modelAnswer: "Nice to meet you, too.",
      modelAnswerJa: "わたしも あえて うれしいよ。",
      choices: ["Nice to meet you, too.", "I'm hungry.", "Yes, it is.", "Red, please."],
      accept: [["nice to meet you", "nice to see you"]],
      visual: "🤝",
    },
  ],
};

const shop: TalkScene = {
  id: "shop",
  title: "おみせで かいもの",
  titleEn: "At the shop",
  description: "オリジナルパフェや ピザの ざいりょうを えいごで たのもう",
  emoji: "🍎",
  background: "/scenes/shop.svg",
  turns: [
    {
      id: "shop-want",
      prompt: "Hello! What do you want?",
      promptJa: "いらっしゃいませ！ なにが ほしいですか？",
      answerHintJa: "ほしい くだものの なまえに「please」を つけてみよう",
      modelAnswer: "Apples, please.",
      modelAnswerJa: "りんごを ください。",
      choices: ["Apples, please.", "I'm fine.", "Good morning.", "It's Monday."],
      accept: [[...FRUITS]],
      visual: "🍎🍌🍊",
    },
    {
      id: "shop-how-many",
      prompt: "How many apples do you want?",
      promptJa: "りんごは いくつ ほしいですか？",
      answerHintJa: "かずを えいごで いってみよう(3こなら three)",
      modelAnswer: "Three, please.",
      modelAnswerJa: "3こ ください。",
      choices: ["Three, please.", "Red, please.", "I like dogs.", "Goodbye."],
      accept: [[...NUMBERS]],
      visual: "🍎🍎🍎",
    },
    {
      id: "shop-here-you-are",
      prompt: "Here you are.",
      promptJa: "はい、どうぞ。",
      answerHintJa: "もらったら おれいを いおう",
      modelAnswer: "Thank you.",
      modelAnswerJa: "ありがとう。",
      choices: ["Thank you.", "How are you?", "I'm ten.", "It's a pen."],
      accept: [["thank you", "thanks"]],
      visual: "🛍️",
    },
    {
      id: "shop-bye",
      prompt: "Thank you! Goodbye!",
      promptJa: "ありがとう！ さようなら！",
      answerHintJa: "さようならは「Goodbye!」だよ",
      modelAnswer: "Goodbye!",
      modelAnswerJa: "さようなら！",
      choices: ["Goodbye!", "Good morning!", "Apples, please.", "I'm fine."],
      accept: [[...BYE]],
      visual: "👋",
    },
  ],
};

const park: TalkScene = {
  id: "park",
  title: "こうえんで あそぼう",
  titleEn: "At the park",
  description: "こうえんで すきな スポーツや どうぶつの おはなしを しよう",
  emoji: "⚽",
  background: "/scenes/park.svg",
  turns: [
    {
      id: "park-soccer",
      prompt: "Let's play! Do you like soccer?",
      promptJa: "あそぼう！ サッカーは すき？",
      answerHintJa: "すきなら「Yes, I do.」、すきじゃないなら「No, I don't.」",
      modelAnswer: "Yes, I do.",
      modelAnswerJa: "うん、すきだよ。",
      choices: ["Yes, I do.", "I'm ten.", "Three, please.", "Good night."],
      accept: [["yes", "no", "yeah"]],
      visual: "⚽",
    },
    {
      id: "park-dog",
      prompt: "Look! What's this?",
      promptJa: "みて！ これは なあに？",
      answerHintJa: "「It's a 〇〇.」で こたえよう。いぬは dog だよ",
      modelAnswer: "It's a dog.",
      modelAnswerJa: "いぬだよ。",
      choices: ["It's a dog.", "It's a cat.", "It's a bird.", "It's a fish."],
      accept: [["dog", "doggy", "puppy"]],
      visual: "🐶",
    },
    {
      id: "park-ball-color",
      prompt: "What color is the ball?",
      promptJa: "ボールは なにいろ？",
      answerHintJa: "あかは red だよ。「It's red.」って いってみよう",
      modelAnswer: "It's red.",
      modelAnswerJa: "あかだよ。",
      choices: ["It's red.", "It's blue.", "It's yellow.", "It's green."],
      accept: [["red"]],
      visual: "🔴",
    },
    {
      id: "park-see-you",
      prompt: "It's five o'clock. Time to go home! See you!",
      promptJa: "もう 5じだね。そろそろ かえる じかんだよ。またね！",
      answerHintJa: "「またね」は「See you!」だよ",
      modelAnswer: "See you!",
      modelAnswerJa: "またね！",
      choices: ["See you!", "Thank you.", "Yes, it is.", "Apples, please."],
      accept: [[...BYE]],
      visual: "🌇",
    },
  ],
};

const school: TalkScene = {
  id: "school",
  title: "がっこうで",
  titleEn: "At school",
  description: "きょうしつで あさの あいさつや 授業の おはなしを しよう",
  emoji: "✏️",
  background: "/scenes/school.svg",
  turns: [
    {
      id: "school-morning",
      prompt: "Good morning!",
      promptJa: "おはよう！",
      answerHintJa: "おなじ ように「Good morning!」と かえそう",
      modelAnswer: "Good morning!",
      modelAnswerJa: "おはよう！",
      choices: ["Good morning!", "Good night!", "Goodbye!", "Thank you!"],
      accept: [["morning", "hello", "hi"]],
      visual: "☀️",
    },
    {
      id: "school-pencil",
      prompt: "What's this?",
      promptJa: "これは なあに？",
      answerHintJa: "えんぴつは pencil。「It's a pencil.」だよ",
      modelAnswer: "It's a pencil.",
      modelAnswerJa: "えんぴつだよ。",
      choices: ["It's a pencil.", "It's an eraser.", "It's a book.", "It's a bag."],
      accept: [["pencil"]],
      visual: "✏️",
    },
    {
      id: "school-books",
      prompt: "How many books?",
      promptJa: "ほんは なんさつ あるかな？",
      answerHintJa: "かぞえて えいごで いおう。3は three",
      modelAnswer: "Three.",
      modelAnswerJa: "3さつ。",
      choices: ["Three.", "Five.", "Two.", "Ten."],
      accept: [["three", "3"]],
      visual: "📕📗📘",
    },
    {
      id: "school-sing",
      prompt: "Let's go to the music room and sing a song!",
      promptJa: "おんがくしつに いって いっしょに うたを うたおう！",
      answerHintJa: "さんせいなら「Yes, let's!」だよ",
      modelAnswer: "Yes, let's!",
      modelAnswerJa: "うん、いこう！",
      choices: ["Yes, let's!", "It's a cat.", "I'm ten.", "Three, please."],
      accept: [["yes", "ok", "okay", "sure", "lets", "yeah"]],
      visual: "🎵",
    },
  ],
};

const zoo: TalkScene = {
  id: "zoo",
  title: "どうぶつえん",
  titleEn: "At the zoo",
  description: "どうぶつえんで すきな どうぶつの おはなし",
  emoji: "🐘",
  background: "/scenes/zoo.svg",
  turns: [
    {
      id: "zoo-like",
      prompt: "What animal do you like?",
      promptJa: "どの どうぶつが すき？",
      answerHintJa: "「I like 〇〇.」で すきな どうぶつを いおう",
      modelAnswer: "I like pandas.",
      modelAnswerJa: "パンダが すき。",
      choices: ["I like pandas.", "I'm fine.", "Good morning.", "It's Monday."],
      accept: [[...ANIMALS]],
      visual: "🐼🦁🦒",
    },
    {
      id: "zoo-elephant",
      prompt: "Look! What's this?",
      promptJa: "みて！ これは なあに？",
      answerHintJa: "ぞうは elephant だよ",
      modelAnswer: "It's an elephant.",
      modelAnswerJa: "ぞうだよ。",
      choices: ["It's an elephant.", "It's a lion.", "It's a monkey.", "It's a giraffe."],
      accept: [["elephant"]],
      visual: "🐘",
    },
    {
      id: "zoo-big",
      prompt: "Is it big?",
      promptJa: "ぞうは おおきい？",
      answerHintJa: "おおきいなら「Yes, it is.」だよ",
      modelAnswer: "Yes, it is.",
      modelAnswerJa: "うん、おおきいね。",
      choices: ["Yes, it is.", "No, it isn't.", "I'm ten.", "Thank you."],
      accept: [["yes", "yeah", "big"]],
      visual: "🐘",
    },
    {
      id: "zoo-bye",
      prompt: "That was fun! Bye!",
      promptJa: "たのしかったね！ バイバイ！",
      answerHintJa: "「Bye! Thank you!」って いってみよう",
      modelAnswer: "Bye! Thank you!",
      modelAnswerJa: "バイバイ！ ありがとう！",
      choices: ["Bye! Thank you!", "Apples, please.", "It's red.", "I'm ten."],
      accept: [[...BYE, "thank you", "thanks"]],
      visual: "👋",
    },
  ],
};

export const TALK_SCENES: readonly TalkScene[] = [greeting, shop, park, school, zoo];

export const getTalkScene = (sceneId: string): TalkScene | undefined =>
  TALK_SCENES.find(({ id }) => id === sceneId);

export const getTalkTurn = (sceneId: string, turnId: string): TalkTurn | undefined =>
  getTalkScene(sceneId)?.turns.find(({ id }) => id === turnId);
