import type { Grade2Unit, Subject } from "./subjects";
import { GRADE_2_MATH_CURRICULUM } from "./grade2Math";
import { GRADE_2_JAPANESE_CURRICULUM } from "./grade2Japanese";

export interface CurriculumProblem {
  id: string;
  subject: Subject;
  unitId: string;
  unit: Grade2Unit;
  subUnit: string;
  problemText: string;
  correctAnswer: string;
  hints: {
    hint1: string;
    hint2: string;
    solution: string;
    answer: string;
    praise: string;
  };
  recommendedVisualTemplate?: string | null;
}

export interface CurriculumStage {
  id: string;
  subject: Subject;
  unit: Grade2Unit;
  title: string;
  emoji: string;
  description: string;
  problemCount: number;
  firstProblemId: string;
}

/**
 * 小学2年生の全単元（算数11単元・国語5単元）に対応した充実の問題バンク。
 * 文部科学省 小2学習指導要領準拠・子どもに寄り添うやさしい文言。
 */
export const CURRICULUM_PROBLEMS: readonly CurriculumProblem[] = [
  // ==========================================
  // 算数 (Grade 2 Math)
  // ==========================================
  // 1. 水のかさ (volume)
  {
    id: "volume-1",
    subject: "math",
    unitId: "volume",
    unit: "水のかさ",
    subUnit: "LとmL",
    problemText: "1Lは何mLですか。",
    correctAnswer: "1000mL",
    hints: {
      hint1: "1Lの中には、100mLがいくつあるかな。",
      hint2: "100mLが10こで1Lだよ。",
      praise: "よく考えたね。",
      solution: "100を10こあわせます。",
      answer: "1000mL",
    },
    recommendedVisualTemplate: "volume",
  },
  {
    id: "volume-2",
    subject: "math",
    unitId: "volume",
    unit: "水のかさ",
    subUnit: "LとdL",
    problemText: "1Lは何dLですか。",
    correctAnswer: "10dL",
    hints: {
      hint1: "1Lの入れものに、1dLますは何ばい入るかな。",
      hint2: "dLは、1Lを10こに分けた大きさだよ。",
      praise: "dLの単位もバッチリだね！",
      solution: "1Lは 1dLが 10こ分です。",
      answer: "10dL",
    },
    recommendedVisualTemplate: "volume",
  },
  {
    id: "volume-3",
    subject: "math",
    unitId: "volume",
    unit: "水のかさ",
    subUnit: "かさのたし算とひき算",
    problemText: "2L 3dLの 水と、1L 4dLの 水を あわせると、何L何dLですか。",
    correctAnswer: "3L7dL",
    hints: {
      hint1: "LはLどうし、dLはdLどうしで たしてみよう。",
      hint2: "2L + 1L と、3dL + 4dL を 計算しよう。",
      praise: "単位ごとに 正しく 計算できたね！",
      solution: "2+1=3L、3+4=7dL なので、3L7dL です。",
      answer: "3L7dL",
    },
    recommendedVisualTemplate: "volume",
  },

  // 2. たし算 (addition)
  {
    id: "addition-1",
    subject: "math",
    unitId: "addition",
    unit: "たし算",
    subUnit: "くり上がり",
    problemText: "28 + 15 は いくつですか。",
    correctAnswer: "43",
    hints: {
      hint1: "一の位の 8 + 5 を 計算してみよう。",
      hint2: "8 + 5 = 13 だから、十の位に 1 くり上がるよ。",
      praise: "くり上がりの 計算、見事大正解！",
      solution: "8+5=13。20+10+10=40。あわせて 43 です。",
      answer: "43",
    },
    recommendedVisualTemplate: "addition",
  },
  {
    id: "addition-2",
    subject: "math",
    unitId: "addition",
    unit: "たし算",
    subUnit: "2けたのたし算",
    problemText: "37 + 45 は いくつですか。",
    correctAnswer: "82",
    hints: {
      hint1: "まず 一の位：7 + 5 は いくつかな？",
      hint2: "7 + 5 = 12 で、十の位へ 1 くり上がるよ。",
      praise: "大きな数の たし算も ばっちり！",
      solution: "7+5=12、30+40+10=80。あわせて 82 です。",
      answer: "82",
    },
    recommendedVisualTemplate: "addition",
  },
  {
    id: "addition-3",
    subject: "math",
    unitId: "addition",
    unit: "たし算",
    subUnit: "たし算の文章題",
    problemText: "あめが 18こ あります。25こ もらいました。全部で 何こですか。",
    correctAnswer: "43こ",
    hints: {
      hint1: "全部で いくつかを もとめるから、たし算だね。",
      hint2: "式は 18 + 25 だよ。",
      praise: "文章題の 式も 答えも 正しくつくれたね！",
      solution: "18 + 25 = 43。答えは 43こ です。",
      answer: "43こ",
    },
    recommendedVisualTemplate: "addition",
  },

  // 3. ひき算 (subtraction)
  {
    id: "subtraction-1",
    subject: "math",
    unitId: "subtraction",
    unit: "ひき算",
    subUnit: "くり下がり",
    problemText: "52 - 18 は いくつですか。",
    correctAnswer: "34",
    hints: {
      hint1: "一の位の 2から 8は ひけないから、十の位から 10 かりてこよう。",
      hint2: "12 - 8 = 4。十の位は 4 - 1 = 3 になるよ。",
      praise: "くり下がりの ひき算、大正解！",
      solution: "12-8=4、40-10=30。あわせて 34 です。",
      answer: "34",
    },
    recommendedVisualTemplate: "subtraction",
  },
  {
    id: "subtraction-2",
    subject: "math",
    unitId: "subtraction",
    unit: "ひき算",
    subUnit: "ひき算の文章題",
    problemText: "おりがみが 45まい あります。19まい 使いました。のこりは 何まいですか。",
    correctAnswer: "26まい",
    hints: {
      hint1: "のこりを もとめるから、ひき算の式にしよう。",
      hint2: "式は 45 - 19 だよ。一の位に くり下げよう。",
      praise: "文章から ひき算を見つけて とけたね！",
      solution: "45 - 19 = 26。答えは 26まい です。",
      answer: "26まい",
    },
    recommendedVisualTemplate: "subtraction",
  },

  // 4. かけ算 (multiplication)
  {
    id: "multiplication-1",
    subject: "math",
    unitId: "multiplication",
    unit: "かけ算",
    subUnit: "九九",
    problemText: "3こずつ 4さらに のっています。全部で 何こですか。",
    correctAnswer: "12こ",
    hints: {
      hint1: "1さらに 3こ。それが 4さら あるよ。",
      hint2: "式は 3 × 4。さんし…？",
      praise: "九九の 3のだん、よく おぼえているね！",
      solution: "3 × 4 = 12。答えは 12こ です。",
      answer: "12こ",
    },
    recommendedVisualTemplate: "multiplication",
  },
  {
    id: "multiplication-2",
    subject: "math",
    unitId: "multiplication",
    unit: "かけ算",
    subUnit: "九九",
    problemText: "6 × 7 の 答えは いくつですか。",
    correctAnswer: "42",
    hints: {
      hint1: "6のだんの 九九を 思い出してみよう。",
      hint2: "ろく・いち・が・ろく、ろくにじゅうに… ろくしち…？",
      praise: "むずかしい 6のだんの九九、ばっちりクリア！",
      solution: "ろくしち 42 です。",
      answer: "42",
    },
    recommendedVisualTemplate: "multiplication",
  },
  {
    id: "multiplication-3",
    subject: "math",
    unitId: "multiplication",
    unit: "かけ算",
    subUnit: "九九",
    problemText: "8のだん： 8 × 4 は いくつですか。",
    correctAnswer: "32",
    hints: {
      hint1: "8のだんの 九九を 言ってみよう。",
      hint2: "はち・いち・が・はち、はちにじゅうろく、はっさん…？",
      praise: "8のだんも すらすら とけたね！",
      solution: "はちし 32 です。",
      answer: "32",
    },
    recommendedVisualTemplate: "multiplication",
  },

  // 5. 時こくと時間 (time)
  {
    id: "time-1",
    subject: "math",
    unitId: "time",
    unit: "時こくと時間",
    subUnit: "時間",
    problemText: "3時15分の 30分後は、何時何分ですか。",
    correctAnswer: "3時45分",
    hints: {
      hint1: "「分」のところに 30分を たしてみよう。",
      hint2: "15分 + 30分 = 45分 だね。",
      praise: "時計の 針の進み方が よくわかっているね！",
      solution: "15 + 30 = 45 なので、3時45分 です。",
      answer: "3時45分",
    },
    recommendedVisualTemplate: "time",
  },
  {
    id: "time-2",
    subject: "math",
    unitId: "time",
    unit: "時こくと時間",
    subUnit: "時間",
    problemText: "1時間は 何分ですか。",
    correctAnswer: "60分",
    hints: {
      hint1: "時計の 長い針が 1まわりすると、何分かな？",
      hint2: "1めもりは 1分、数字ひとつで 5分進むよ。",
      praise: "時間の たいせつな きまり、大正解！",
      solution: "長い針が 1周すると 60分です。1時間は 60分 です。",
      answer: "60分",
    },
    recommendedVisualTemplate: "time",
  },

  // 6. 長さ (length)
  {
    id: "length-1",
    subject: "math",
    unitId: "length",
    unit: "長さ",
    subUnit: "mとcm",
    problemText: "1mは 何cmですか。",
    correctAnswer: "100cm",
    hints: {
      hint1: "1mものさしには、1cmがいくつあるかな。",
      hint2: "10cmが 10こで 1m になるよ。",
      praise: "メートルと センチの関係、しっかりつかめたね！",
      solution: "1m は 100cm です。",
      answer: "100cm",
    },
    recommendedVisualTemplate: "length",
  },
  {
    id: "length-2",
    subject: "math",
    unitId: "length",
    unit: "長さ",
    subUnit: "cmとmm",
    problemText: "1cmは 何mmですか。",
    correctAnswer: "10mm",
    hints: {
      hint1: "ものさしの 1cmのあいだの 小さなめもりを 数えてみよう。",
      hint2: "小さな 1めもりが 1mm だよ。",
      praise: "ミリメートルの 単位も かんぺき！",
      solution: "1cm は 10mm です。",
      answer: "10mm",
    },
    recommendedVisualTemplate: "length",
  },

  // 7. 三角形と四角形 (shapes)
  {
    id: "shapes-1",
    subject: "math",
    unitId: "shapes",
    unit: "三角形と四角形",
    subUnit: "三角形",
    problemText: "三角形の「ちょう点」は いくつありますか。",
    correctAnswer: "3つ",
    hints: {
      hint1: "ちょう点は、まがりかどの とがったところだよ。",
      hint2: "三角形は、3つの辺と、いくつかのちょう点があるよ。",
      praise: "図形のかたちを よく見極められたね！",
      solution: "三角形には ちょう点が 3つ あります。",
      answer: "3つ",
    },
    recommendedVisualTemplate: "shapes",
  },
  {
    id: "shapes-2",
    subject: "math",
    unitId: "shapes",
    unit: "三角形と四角形",
    subUnit: "長方形と正方形",
    problemText: "4つの「辺」の長さが 全部同じで、4つの角が直角の四角形を 何といいますか。",
    correctAnswer: "正方形",
    hints: {
      hint1: "長方形と よく似ているけれど、辺の長さが 4つとも同じだよ。",
      hint2: "「せい…」から はじまる 四角形の名前だよ。",
      praise: "正方形の かたちを ばっちりおぼえているね！",
      solution: "辺がすべて同じ長さで 4つの角が直角なのは「正方形」です。",
      answer: "正方形",
    },
    recommendedVisualTemplate: "shapes",
  },

  // 8. 1000より大きい数 (large-numbers)
  {
    id: "large-numbers-1",
    subject: "math",
    unitId: "large-numbers",
    unit: "1000より大きい数",
    subUnit: "10000までの数",
    problemText: "100を 10こ 集めた数は いくつですか。",
    correctAnswer: "1000",
    hints: {
      hint1: "100、200、300… と 100ずつ 数えてみよう。",
      hint2: "900の 次の 大きな数だよ。",
      praise: "千の位の 大きな数、大正解！",
      solution: "100を 10こ 集めると 1000（千）です。",
      answer: "1000",
    },
    recommendedVisualTemplate: "place-value",
  },
  {
    id: "large-numbers-2",
    subject: "math",
    unitId: "large-numbers",
    unit: "1000より大きい数",
    subUnit: "数のしくみ",
    problemText: "1000を 3こ、100を 5こ あわせた数は いくつですか。",
    correctAnswer: "3500",
    hints: {
      hint1: "千の位が 3、百の位が 5 だね。",
      hint2: "十の位と 一の位は 0 だよ。",
      praise: "位のしくみ、しっかり わかるようになったね！",
      solution: "1000が3こで3000、100が5こで500。あわせて 3500 です。",
      answer: "3500",
    },
    recommendedVisualTemplate: "place-value",
  },

  // 9. 分数 (fractions)
  {
    id: "fractions-1",
    subject: "math",
    unitId: "fractions",
    unit: "分数",
    subUnit: "2分の1",
    problemText: "1つの丸を 同じ大きさに 2つに分けた 1つ分を 何といいますか。",
    correctAnswer: "2分の1",
    hints: {
      hint1: "半分（はんぶん）のことだよ。",
      hint2: "「○分の○」という 言葉で かいてみよう。",
      praise: "分数の 考え方、大正解！",
      solution: "同じ大きさに 2つに分けた 1つ分は「2分の1」です。",
      answer: "2分の1",
    },
    recommendedVisualTemplate: "fractions",
  },

  // 10. はこの形 (boxes)
  {
    id: "boxes-1",
    subject: "math",
    unitId: "boxes",
    unit: "はこの形",
    subUnit: "面",
    problemText: "はこの形には、「面」が いくつありますか。",
    correctAnswer: "6つ",
    hints: {
      hint1: "サイコロの 目の数を 思い出してみよう。",
      hint2: "上と下、前と後ろ、右と左で あわせて いくつかな？",
      praise: "はこの形の 面の数、しっかり かぞえられたね！",
      solution: "はこの形の面は、うえ・した・まえ・うしろ・みぎ・ひだりで 6つ あります。",
      answer: "6つ",
    },
    recommendedVisualTemplate: "boxes",
  },

  // 11. 表とグラフ (tables-and-graphs)
  {
    id: "tables-and-graphs-1",
    subject: "math",
    unitId: "tables-and-graphs",
    unit: "表とグラフ",
    subUnit: "表の読み方",
    problemText: "りんごが 5人、みかんが 8人 います。あわせて 何人ですか。",
    correctAnswer: "13人",
    hints: {
      hint1: "「あわせて」だから、たし算だね。",
      hint2: "式は 5 + 8 だよ。",
      praise: "表の合計の 計算、ばっちり！",
      solution: "5 + 8 = 13。答えは 13人 です。",
      answer: "13人",
    },
    recommendedVisualTemplate: "tables-and-graphs",
  },

  // ==========================================
  // 国語 (Grade 2 Japanese)
  // ==========================================
  // 1. 漢字 (kanji)
  {
    id: "kanji-1",
    subject: "japanese",
    unitId: "kanji",
    unit: "漢字",
    subUnit: "漢字の書き",
    problemText: "つぎの ことばを 漢字で 書きましょう。「あおぞら」",
    correctAnswer: "青空",
    hints: {
      hint1: "「あお」と「ぞら」をそれぞれ漢字で思い出してみよう。",
      hint2: "「青」と「空」の２文字を組み合わせるよ。",
      praise: "漢字をよく思い出せたね！",
      solution: "「あお」は「青」、「ぞら」は「空」で「青空」と書きます。",
      answer: "青空",
    },
  },
  {
    id: "kanji-2",
    subject: "japanese",
    unitId: "kanji",
    unit: "漢字",
    subUnit: "漢字の読み",
    problemText: "つぎの 漢字の 読み方を ひらがなで 書きましょう。「春風」",
    correctAnswer: "はるかぜ",
    hints: {
      hint1: "「春」と「風」の 読み方を あわせよう。",
      hint2: "あたたかい 季節に ふく 風のことだよ。",
      praise: "季節の 漢字の読み方、大正解！",
      solution: "「春」は「はる」、「風」は「かぜ」で「はるかぜ」と読みます。",
      answer: "はるかぜ",
    },
  },
  {
    id: "kanji-3",
    subject: "japanese",
    unitId: "kanji",
    unit: "漢字",
    subUnit: "漢字の書き",
    problemText: "つぎの ことばを 漢字で 書きましょう。「ともだち」",
    correctAnswer: "友だち",
    hints: {
      hint1: "「とも」を 漢字で 書くよ。",
      hint2: "「友」の字を 思い出してみよう（友だち）。",
      praise: "たいせつな 漢字、しっかり書けたね！",
      solution: "「とも」は「友」と書いて「友だち」です。",
      answer: "友だち",
    },
  },
  {
    id: "kanji-4",
    subject: "japanese",
    unitId: "kanji",
    unit: "漢字",
    subUnit: "漢字の読み",
    problemText: "つぎの 漢字の 読み方を ひらがなで 書きましょう。「学校」",
    correctAnswer: "がっこう",
    hints: {
      hint1: "まいにち 通う ばしょのことだよ。",
      hint2: "小さい「っ」が 入るよ。",
      praise: "学校の 漢字も ばっちり読めたね！",
      solution: "「学校」は「がっこう」と読みます。",
      answer: "がっこう",
    },
  },

  // 2. ことばのきまり (vocabulary)
  {
    id: "vocabulary-1",
    subject: "japanese",
    unitId: "vocabulary",
    unit: "ことばのきまり",
    subUnit: "反対の意味の言葉",
    problemText: "「高い」の 反対の意味の 言葉は 何ですか。",
    correctAnswer: "低い",
    hints: {
      hint1: "「せが たかい」の 反対は…？",
      hint2: "「ひくい」を 漢字または ひらがなで 書こう。",
      praise: "反対ことばの みつけかた、かんぺき！",
      solution: "「高い」の反対は「低い（ひくい）」です。",
      answer: "低い",
    },
  },
  {
    id: "vocabulary-2",
    subject: "japanese",
    unitId: "vocabulary",
    unit: "ことばのきまり",
    subUnit: "反対の意味の言葉",
    problemText: "「あかるい」の 反対の意味の 言葉は 何ですか。",
    correctAnswer: "くらい",
    hints: {
      hint1: "夜になって へやの あかりが きえると…？",
      hint2: "「く」から はじまる 3文字の 言葉だよ。",
      praise: "ようすを 表す言葉、よく知っているね！",
      solution: "「あかるい」の反対は「くらい」です。",
      answer: "くらい",
    },
  },
  {
    id: "vocabulary-3",
    subject: "japanese",
    unitId: "vocabulary",
    unit: "ことばのきまり",
    subUnit: "なかまの言葉",
    problemText: "いぬ、ねこ、うさぎは、何のなかまの 言葉ですか。",
    correctAnswer: "どうぶつ",
    hints: {
      hint1: "生きものの なかまだよ。",
      hint2: "ひらがなで「どうぶつ」と かくよ。",
      praise: "なかまの言葉を ぴったり見つけられたね！",
      solution: "いぬや ねこは「どうぶつ」の なかまです。",
      answer: "どうぶつ",
    },
  },

  // 3. 文の組み立て (sentences)
  {
    id: "sentences-1",
    subject: "japanese",
    unitId: "sentences",
    unit: "文の組み立て",
    subUnit: "主語と述語",
    problemText: "「いぬが 元気に はしる。」の 文で、「主語（だれが）」は どれですか。",
    correctAnswer: "いぬが",
    hints: {
      hint1: "「だれが・なにが」に あたる 言葉を さがそう。",
      hint2: "はしっているのは だれかな？",
      praise: "主語を 正確に見つけ出せたね！",
      solution: "「だれが」にあたるのは「いぬが」です。",
      answer: "いぬが",
    },
  },
  {
    id: "sentences-2",
    subject: "japanese",
    unitId: "sentences",
    unit: "文の組み立て",
    subUnit: "助詞（は・を・へ）",
    problemText: "「公園（　）行く。」の（　）に入る、正しい ひらがな 1文字は 何ですか。",
    correctAnswer: "へ",
    hints: {
      hint1: "行く ばしょや 方向を 表す 助詞だよ。",
      hint2: "「へ」または「に」が つかえるよ。",
      praise: "つなぎ言葉の つかいかた、大正解！",
      solution: "ばしょへ 向かうときは「へ（または に）」をつかいます。",
      answer: "へ",
    },
  },

  // 4. お話の読解 (reading-story)
  {
    id: "reading-story-1",
    subject: "japanese",
    unitId: "reading-story",
    unit: "お話の読解",
    subUnit: "登場人物の気持ち",
    problemText: "友だちに「ありがとう！」と 言われたときの たけしさんの 気持ちは どちらですか。（うれしい / かなしい）",
    correctAnswer: "うれしい",
    hints: {
      hint1: "「ありがとう」と 言われたとき、どんな 気持ちに なるかな？",
      hint2: "にこにこ 笑っているよ。",
      praise: "登場人物の 気持ちを しっかり読み取れたね！",
      solution: "「ありがとう」と言われて、たけしさんは「うれしい」気持ちになりました。",
      answer: "うれしい",
    },
  },

  // 5. 説明文の読解 (reading-explanation)
  {
    id: "reading-explanation-1",
    subject: "japanese",
    unitId: "reading-explanation",
    unit: "説明文の読解",
    subUnit: "順序を表す言葉",
    problemText: "作り方を 説明するとき、最初に 使う 言葉は どちらですか。（まず / さいごに）",
    correctAnswer: "まず",
    hints: {
      hint1: "1ばん はじめに やることを 言う ときの 言葉だよ。",
      hint2: "「（　）、じゅんびを します。」のように 使うよ。",
      praise: "順序を 表す言葉、よく わかったね！",
      solution: "いちばん最初には「まず」を使います。",
      answer: "まず",
    },
  },
];

export function getCurriculumProblemById(id: string): CurriculumProblem | undefined {
  return CURRICULUM_PROBLEMS.find((p) => p.id === id);
}

export function getCurriculumProblemsBySubject(subject: Subject): CurriculumProblem[] {
  return CURRICULUM_PROBLEMS.filter((p) => p.subject === subject);
}

export function getCurriculumProblemsByUnit(unit: string): CurriculumProblem[] {
  return CURRICULUM_PROBLEMS.filter((p) => p.unit === unit);
}

/**
 * 現在の問題の「つぎの問題」を取得する。
 * 同じ単元内に次の問題があればそれを返し、
 * 単元の最後の問題であれば、次の単元の第1問を返す。
 * 全問解き終わったら最初の問題へループする。
 */
export function getNextCurriculumProblem(currentId: string): CurriculumProblem | null {
  const current = getCurriculumProblemById(currentId);
  if (!current) {
    // 未知のIDなら算数の第1問へ
    return CURRICULUM_PROBLEMS[0] ?? null;
  }

  const subjectProblems = getCurriculumProblemsBySubject(current.subject);
  const currentIndex = subjectProblems.findIndex((p) => p.id === currentId);
  if (currentIndex === -1) return subjectProblems[0] ?? null;

  const nextIndex = (currentIndex + 1) % subjectProblems.length;
  return subjectProblems[nextIndex] ?? null;
}

/**
 * 単元内での進行度（例: "たし算 1 / 3"）を取得する
 */
export function getCurriculumStageProgress(problemId: string): {
  unit: string;
  index: number;
  total: number;
  label: string;
} | null {
  const problem = getCurriculumProblemById(problemId);
  if (!problem) return null;

  const unitProblems = getCurriculumProblemsByUnit(problem.unit);
  const index = unitProblems.findIndex((p) => p.id === problemId);
  if (index === -1) return null;

  return {
    unit: problem.unit,
    index: index + 1,
    total: unitProblems.length,
    label: `${problem.unit} ${index + 1} / ${unitProblems.length}`,
  };
}

/**
 * ステージ選択カード用データ
 */
export function getCurriculumStages(subject: Subject): CurriculumStage[] {
  if (subject === "math") {
    return GRADE_2_MATH_CURRICULUM.map((unitDef) => {
      const problems = CURRICULUM_PROBLEMS.filter((p) => p.unit === unitDef.unit);
      const emojiMap: Record<string, string> = {
        "水のかさ": "🌊",
        "たし算": "➕",
        "ひき算": "➖",
        "かけ算": "✖️",
        "時こくと時間": "⏰",
        "長さ": "📏",
        "三角形と四角形": "📐",
        "1000より大きい数": "🔢",
        "分数": "🍰",
        "はこの形": "📦",
        "表とグラフ": "📊",
      };

      return {
        id: unitDef.id,
        subject: "math",
        unit: unitDef.unit,
        title: unitDef.unit,
        emoji: emojiMap[unitDef.unit] ?? "🧮",
        description: unitDef.subUnits.join("・"),
        problemCount: problems.length,
        firstProblemId: problems[0]?.id ?? "volume-1",
      };
    });
  }

  return GRADE_2_JAPANESE_CURRICULUM.map((unitDef) => {
    const problems = CURRICULUM_PROBLEMS.filter((p) => p.unit === unitDef.unit);
    const emojiMap: Record<string, string> = {
      "漢字": "✍️",
      "ことばのきまり": "🔄",
      "文の組み立て": "🧩",
      "お話の読解": "📚",
      "説明文の読解": "🔍",
      "作文と表現": "📝",
    };

    return {
      id: unitDef.id,
      subject: "japanese",
      unit: unitDef.unit,
      title: unitDef.unit,
      emoji: emojiMap[unitDef.unit] ?? "📖",
      description: unitDef.subUnits.join("・"),
      problemCount: problems.length,
      firstProblemId: problems[0]?.id ?? "kanji-1",
    };
  });
}
