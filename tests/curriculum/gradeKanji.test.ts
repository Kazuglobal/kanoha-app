import { describe, expect, it } from "vitest";
import { KANJI_WORDS } from "@/lib/curriculum/gradeKanji";

/** 学習指導要領の学年別漢字配当表(1年 80 字・2年 160 字)。実装とは別に、ここで持つ。 */
const GRADE_1 = "一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六";
const GRADE_2 =
  "引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話";
const HAN = /\p{Script=Han}/u;
const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/;

const hanOf = (word: string) => [...word].filter((char) => HAN.test(char));

describe("漢字の表", () => {
  it("学年別漢字配当表の字数", () => {
    expect([...GRADE_1]).toHaveLength(80);
    expect([...GRADE_2]).toHaveLength(160);
    expect(new Set([...GRADE_1, ...GRADE_2]).size).toBe(240);
  });

  it("どの語も、1・2年で習う漢字だけでできている", () => {
    for (const item of KANJI_WORDS) {
      for (const char of hanOf(item.word)) {
        expect(GRADE_1.includes(char) || GRADE_2.includes(char), `${item.word} の「${char}」`).toBe(true);
      }
    }
  });

  it("grade 1 の語は 1年の漢字だけ。grade 2 の語は 2年の漢字を 1 字以上ふくむ", () => {
    for (const item of KANJI_WORDS) {
      const chars = hanOf(item.word);
      if (item.grade === 1) expect(chars.every((char) => GRADE_1.includes(char)), item.word).toBe(true);
      else expect(chars.some((char) => GRADE_2.includes(char)), item.word).toBe(true);
    }
  });

  it("single は漢字 1 字だけ、compound は 2 字以上(送りがな・熟語)", () => {
    for (const item of KANJI_WORDS) {
      if (item.kind === "single") expect([...item.word], item.word).toHaveLength(1);
      else expect([...item.word].length, item.word).toBeGreaterThanOrEqual(2);
    }
  });

  it("読みは ひらがなだけで、どの語も ちがう(読みから漢字をえらぶときに答えが 1 つ)", () => {
    for (const item of KANJI_WORDS) expect(HIRAGANA_ONLY.test(item.reading), item.word).toBe(true);
    expect(new Set(KANJI_WORDS.map((item) => item.reading)).size).toBe(KANJI_WORDS.length);
    expect(new Set(KANJI_WORDS.map((item) => item.word)).size).toBe(KANJI_WORDS.length);
  });

  it("レベルごとの語の集まりが、4 択を作れる大きさ", () => {
    const count = (grade: number, kind: string) => KANJI_WORDS.filter((item) => item.grade === grade && item.kind === kind).length;
    expect(count(1, "single")).toBeGreaterThanOrEqual(12);
    expect(count(1, "compound")).toBeGreaterThanOrEqual(12);
    expect(count(2, "single")).toBeGreaterThanOrEqual(12);
    expect(count(2, "compound")).toBeGreaterThanOrEqual(12);
  });

  it("読みの見本(人の目での確認の手がかり)", () => {
    const readings = new Map(KANJI_WORDS.map((item) => [item.word, item.reading]));
    const samples: [string, string][] = [
      ["山", "やま"], ["川", "かわ"], ["学校", "がっこう"], ["先生", "せんせい"], ["海", "うみ"], ["魚", "さかな"],
      ["弟", "おとうと"], ["妹", "いもうと"], ["新しい", "あたらしい"], ["電車", "でんしゃ"], ["午後", "ごご"],
      ["考える", "かんがえる"], ["食べる", "たべる"], ["行く", "いく"], ["来る", "くる"], ["雪", "ゆき"], ["春", "はる"],
    ];
    for (const [word, reading] of samples) expect(readings.get(word), word).toBe(reading);
  });
});
