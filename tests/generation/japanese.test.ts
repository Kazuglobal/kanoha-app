import { describe, expect, it } from "vitest";
import { KANJI_WORDS } from "@/lib/curriculum/gradeKanji";
import { ANTONYMS, LOANWORDS, NATIVE_WORDS, ONOMATOPOEIA, WORD_CATEGORIES } from "@/lib/curriculum/japaneseWordBank";
import { JAPANESE_GENERATORS } from "@/lib/generation/generators/japanese";
import type { GeneratedProblem } from "@/lib/generation/types";
import { validateGenerated } from "@/lib/generation/validate";
import { LEVELS, type Level } from "@/lib/learning/level";
import { describeBasics, generateAt } from "./support";

const byName = (subUnit: string) => JAPANESE_GENERATORS.find((entry) => entry.subUnit === subUnit)!;
const build = (subUnit: string, level: Level): GeneratedProblem[] => generateAt(byName(subUnit), level);

describe("国語の生成器: 小単元がそろっている", () => {
  it("生成器を持つ小単元(読解・作文・部首/筆順・同じ部分の漢字は問題バンクにまかせる)", () => {
    expect(JAPANESE_GENERATORS.map((entry) => [entry.unit, entry.subUnit])).toEqual([
      ["漢字", "漢字の読み"], ["漢字", "漢字の書き"],
      ["ことばのきまり", "反対の意味の言葉"], ["ことばのきまり", "なかまの言葉"],
      ["ことばのきまり", "カタカナで書く言葉"], ["ことばのきまり", "様子を表す言葉"],
      ["文の組み立て", "主語と述語"], ["文の組み立て", "つなぎ言葉"],
      ["文の組み立て", "助詞（は・を・へ）"], ["文の組み立て", "文の終わり（句読点）"],
    ]);
  });
});

// つなぎ言葉・助詞・句読点は、決まった表から出すので、問題の数が少ない
describeBasics(JAPANESE_GENERATORS, { choiceLevels: [...LEVELS], minVariety: () => 3 });

const readingOf = new Map(KANJI_WORDS.map((item) => [item.word, item.reading]));
const wordOf = new Map(KANJI_WORDS.map((item) => [item.reading, item.word]));

describe("漢字の読み・書き", () => {
  it.each(LEVELS)("読み レベル %i: 『語』の読みが答えで、選択肢はすべて表にある読み", (level) => {
    for (const problem of build("漢字の読み", level)) {
      const word = /『(.+)』/.exec(problem.problemText)![1];
      expect(problem.correctAnswer, problem.problemText).toBe(readingOf.get(word));
      for (const choice of problem.choices!) expect(wordOf.has(choice), choice).toBe(true);
    }
  });

  it.each(LEVELS)("書き レベル %i: 「読み」にあう漢字の語が答えで、選択肢はすべて表にある語", (level) => {
    for (const problem of build("漢字の書き", level)) {
      const reading = /「(.+)」/.exec(problem.problemText)![1];
      expect(problem.correctAnswer, problem.problemText).toBe(wordOf.get(reading));
      for (const choice of problem.choices!) expect(readingOf.has(choice), choice).toBe(true);
    }
  });

  it("レベルごとに出す語: 1年の1字 → 1年の熟語 → 2年の1字 → 2年の熟語", () => {
    const expected: Record<1 | 2 | 3 | 4, [number, string]> = { 1: [1, "single"], 2: [1, "compound"], 3: [2, "single"], 4: [2, "compound"] };
    for (const level of [1, 2, 3, 4] as const) {
      for (const problem of build("漢字の読み", level)) {
        const word = /『(.+)』/.exec(problem.problemText)![1];
        const item = KANJI_WORDS.find((candidate) => candidate.word === word)!;
        expect([item.grade, item.kind]).toEqual(expected[level]);
      }
    }
  });

  it("読み: 問題文の漢字は『』の中だけ(ほかの文は ひらがな)", () => {
    for (const problem of build("漢字の読み", 5)) {
      expect(problem.problemText.replace(/『.+』/, "")).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it("ヒントは「はじめの字」や「字数」で答えを教えない", () => {
    for (const subUnit of ["漢字の読み", "漢字の書き", "様子を表す言葉"]) {
      for (const level of LEVELS) {
        for (const problem of build(subUnit, level)) {
          for (const hint of [problem.hints.hint1, problem.hints.hint2]) expect(hint, subUnit).not.toMatch(/から はじまる|\d+もじ/);
        }
      }
    }
  });

  // ヒントの文は どの語でも同じ。ランダムに引いた語だけでなく、表の全部の語で 答えがヒントに入らないことを確かめる
  it.each([
    ["漢字の読み", (item: (typeof KANJI_WORDS)[number]) => ({ problemText: `『${item.word}』は なんと よみますか。`, correctAnswer: item.reading }), (item: (typeof KANJI_WORDS)[number]) => item.reading],
    ["漢字の書き", (item: (typeof KANJI_WORDS)[number]) => ({ problemText: `「${item.reading}」を かんじで かくと どれですか。`, correctAnswer: item.word }), (item: (typeof KANJI_WORDS)[number]) => item.word],
  ] as const)("%s: 表の どの語でも、ヒントに答えが入らない", (subUnit, asked, shown) => {
    const [base] = build(subUnit, 5);
    for (const item of KANJI_WORDS) {
      const wrong = KANJI_WORDS.filter((other) => other.word !== item.word).slice(0, 3).map(shown);
      const candidate = { ...base, ...asked(item), choices: [shown(item), ...wrong] };
      expect(validateGenerated(candidate), `${item.word}(${item.reading})`).toEqual({ ok: true, issues: [] });
    }
  });
});

describe("反対の意味の言葉", () => {
  const partnerOf = new Map(ANTONYMS.flatMap((item) => [[item.a, item.b], [item.b, item.a]] as const));
  const clusterOf = new Map(ANTONYMS.flatMap((item) => [[item.a, item.cluster], [item.b, item.cluster]] as const));
  const kindOf = new Map(ANTONYMS.flatMap((item) => [[item.a, item.kind], [item.b, item.kind]] as const));
  const KINDS: Record<Level, readonly string[]> = { 1: ["adjective"], 2: ["position"], 3: ["verb"], 4: ["adjective", "verb"], 5: ["adjective", "position", "verb"] };

  it.each(LEVELS)("レベル %i: はんたいの ことばが答え。意味の近い組は まちがいに出さない", (level) => {
    for (const problem of build("反対の意味の言葉", level)) {
      const asked = /『(.+)』/.exec(problem.problemText)![1];
      expect(problem.correctAnswer, problem.problemText).toBe(partnerOf.get(asked));
      expect(KINDS[level]).toContain(kindOf.get(asked));
      for (const choice of problem.choices!.filter((item) => item !== problem.correctAnswer)) {
        expect(clusterOf.get(choice), `${asked} と ${choice}`).not.toBe(clusterOf.get(asked));
      }
    }
  });
});

describe("なかまの言葉", () => {
  const idOfLabel = new Map(WORD_CATEGORIES.map((item) => [item.label, item.id]));
  const categoryOf = new Map(WORD_CATEGORIES.flatMap((item) => item.words.map((word) => [word, item.id] as const)));
  const labelOf = new Map(WORD_CATEGORIES.map((item) => [item.id, item.label]));
  const CLOSE: Record<string, string> = { fruit: "vegetable", vegetable: "fruit", instrument: "stationery", stationery: "instrument" };

  /** 3 つのなかま(home)と、ひとりだけちがう語(outsider)の分類を取り出す。 */
  const split = (problem: GeneratedProblem) => {
    const groups = problem.choices!.map((word) => categoryOf.get(word)!);
    const outsider = categoryOf.get(problem.correctAnswer)!;
    const members = groups.filter((group) => group !== outsider);
    expect(groups.filter((group) => group === outsider), problem.problemText).toHaveLength(1);
    expect(new Set(members).size).toBe(1);
    return { home: members[0], outsider };
  };

  it("レベル 1: まったくちがう なかま(どうぶつ・のりもの・きせつ・いろ ↔ くだもの・やさい・がっき・ぶんぼうぐ)", () => {
    for (const problem of build("なかまの言葉", 1)) {
      const { home, outsider } = split(problem);
      expect(["animal", "vehicle", "season", "color"]).toContain(home);
      expect(["fruit", "vegetable", "instrument", "stationery"]).toContain(outsider);
    }
  });

  it("レベル 2: ふつうのなかまはずれ。にている なかま(くだもの/やさい など)は出さない", () => {
    for (const problem of build("なかまの言葉", 2)) {
      const { home, outsider } = split(problem);
      expect(CLOSE[home], `${home} と ${outsider}`).not.toBe(outsider);
    }
  });

  it("レベル 3: にている なかま(くだもの↔やさい・がっき↔ぶんぼうぐ)だけ", () => {
    for (const problem of build("なかまの言葉", 3)) {
      const { home, outsider } = split(problem);
      expect(CLOSE[home], `${home} と ${outsider}`).toBe(outsider);
    }
  });

  it("レベル 4: 3つの ことばの なかまの名前が答え", () => {
    for (const problem of build("なかまの言葉", 4)) {
      const words = [...problem.problemText.matchAll(/『(.+?)』/g)].map((match) => match[1]);
      expect(words).toHaveLength(3);
      expect(new Set(words.map((word) => labelOf.get(categoryOf.get(word)!)))).toEqual(new Set([problem.correctAnswer]));
    }
  });

  it("レベル 5: 名前の なかまの ことばが答えで、ほかは 別の なかま", () => {
    for (const problem of build("なかまの言葉", 5)) {
      const label = /『(.+)』/.exec(problem.problemText)![1];
      expect(categoryOf.get(problem.correctAnswer), problem.problemText).toBe(idOfLabel.get(label));
      for (const choice of problem.choices!.filter((item) => item !== problem.correctAnswer)) expect(categoryOf.get(choice)).not.toBe(idOfLabel.get(label));
    }
  });

  it("くだものは「もも」「いちご」「すいか」を使わない(からだ・やさいと まぎらわしい)", () => {
    for (const level of LEVELS) {
      for (const problem of build("なかまの言葉", level)) {
        const shown = [problem.problemText, ...problem.choices!].join(" ");
        expect(shown).not.toMatch(/もも|いちご|すいか/);
      }
    }
  });
});

describe("カタカナで書く言葉", () => {
  const byHiragana = new Map(LOANWORDS.map((item) => [item.hiragana, item.katakana]));

  it("レベル 1: カタカナで書く ことば(ひらがなで出す)が答えで、ほかは ふつうの ことば", () => {
    for (const problem of build("カタカナで書く言葉", 1)) {
      expect(LOANWORDS.map((item) => item.hiragana)).toContain(problem.correctAnswer);
      for (const choice of problem.choices!.filter((item) => item !== problem.correctAnswer)) expect(NATIVE_WORDS).toContain(choice);
    }
  });

  it.each([2, 3, 4, 5] as const)("レベル %i: ひらがなの語にあう カタカナが答えで、まちがいは ほんとうの ことばではない", (level) => {
    for (const problem of build("カタカナで書く言葉", level)) {
      const hiragana = /「(.+)」/.exec(problem.problemText)![1];
      expect(problem.correctAnswer, problem.problemText).toBe(byHiragana.get(hiragana));
      for (const choice of problem.choices!.filter((item) => item !== problem.correctAnswer)) {
        expect(LOANWORDS.map((item) => item.katakana)).not.toContain(choice);
      }
    }
  });

  it("レベルごとに ことばの特ちょうがちがう(のばす音・小さい字・長さ)", () => {
    for (const problem of build("カタカナで書く言葉", 2)) expect(problem.correctAnswer).not.toMatch(/[ーッャュョ]/);
    for (const problem of build("カタカナで書く言葉", 3)) {
      expect(problem.correctAnswer).toContain("ー");
      expect(problem.correctAnswer).not.toMatch(/[ッャュョ]/);
    }
    for (const problem of build("カタカナで書く言葉", 4)) expect(problem.correctAnswer).toMatch(/[ッャュョ]/);
    for (const problem of build("カタカナで書く言葉", 5)) expect([...problem.correctAnswer].length).toBeGreaterThanOrEqual(4);
  });

  it("ヒントは「ふつうの ことばは ひらがな」と 反対のことを言わない", () => {
    for (const level of LEVELS) {
      for (const problem of build("カタカナで書く言葉", level)) {
        expect(Object.values(problem.hints).join(" ")).not.toContain("もともと にほんに あった");
      }
    }
  });
});

describe("様子を表す言葉", () => {
  const wordOfScene = new Map(ONOMATOPOEIA.map((item) => [item.scene, item.word]));
  const clusterOf = new Map(ONOMATOPOEIA.map((item) => [item.word, item.cluster]));
  const KINDS: Record<Level, readonly string[]> = { 1: ["animal"], 2: ["weather"], 3: ["manner"], 4: ["feeling"], 5: ["animal", "weather", "manner", "feeling"] };

  it.each(LEVELS)("レベル %i: 場面にあう ことばが答え。意味の近い ことば(cluster)はいっしょに出さない", (level) => {
    for (const problem of build("様子を表す言葉", level)) {
      const scene = /「(.+)」/.exec(problem.problemText)![1];
      expect(problem.correctAnswer, problem.problemText).toBe(wordOfScene.get(scene));
      const item = ONOMATOPOEIA.find((candidate) => candidate.word === problem.correctAnswer)!;
      expect(KINDS[level]).toContain(item.kind);
      if (item.cluster) {
        for (const choice of problem.choices!.filter((word) => word !== item.word)) expect(clusterOf.get(choice), `${item.word} と ${choice}`).not.toBe(item.cluster);
      }
    }
  });
});

describe("主語と述語", () => {
  it.each(LEVELS)("レベル %i: 聞かれた役わりの ことばが答え。同じ文の ほかの部分が 選択肢にまざる", (level) => {
    for (const problem of build("主語と述語", level)) {
      const sentence = /^「(.+?)。」の/.exec(problem.problemText)![1].split(" ");
      const role = problem.problemText.includes("どうした") ? "predicate" : problem.problemText.includes("なにを") ? "object" : "subject";
      const expected = role === "predicate" ? sentence[sentence.length - 1] : role === "subject" ? sentence[0] : sentence.find((word) => word.endsWith("を"));
      expect(problem.correctAnswer, problem.problemText).toBe(expected);
      // 「文にある ことばを さがす」だけでは決められない(同じ文の ほかの部分も 選択肢に入る)
      const fromSentence = problem.choices!.filter((choice) => sentence.includes(choice));
      expect(fromSentence.length, problem.problemText).toBeGreaterThanOrEqual(2);
    }
  });

  it("レベルごとの役わり: 1=どうした 2=だれが 3=どうした 4=だれが 5=なにを", () => {
    const labels: Record<Level, string> = { 1: "どうした", 2: "だれが", 3: "どうした", 4: "だれが", 5: "なにを" };
    for (const level of LEVELS) for (const problem of build("主語と述語", level)) expect(problem.problemText).toContain(labels[level]);
  });
});

describe("つなぎ言葉・助詞・句読点", () => {
  it("つなぎ言葉: 前後の つながりにあう ことばが答え(レベル 1〜3 は だから・でも・そして)", () => {
    const expected: Record<string, string> = {
      "あめが ふりました。": "だから", "かぜを ひきました。": "だから", "おなかが すきました。": "だから", "ねぼうを しました。": "だから",
      "あめが ふっています。": "でも", "ねむかったです。": "でも", "ぼくは いぬが すきです。": "でも", "いっしょうけんめい はしりました。": "でも",
      "あさ おきました。": "そして", "ごはんを たべました。": "そして", "こうえんで あそびました。": "そして", "てを あらいました。": "そして",
    };
    const byLevel: Record<1 | 2 | 3, string> = { 1: "だから", 2: "でも", 3: "そして" };
    for (const level of LEVELS) {
      for (const problem of build("つなぎ言葉", level)) {
        const first = /「(.+?。)（　）/.exec(problem.problemText)![1];
        expect(problem.correctAnswer, problem.problemText).toBe(expected[first]);
        if (level <= 3) expect(problem.correctAnswer).toBe(byLevel[level as 1 | 2 | 3]);
        if (problem.correctAnswer === "だから") expect(problem.choices).not.toContain("そして");
        if (problem.correctAnswer === "そして") expect(problem.choices).not.toContain("だから");
      }
    }
  });

  it("つなぎ言葉: 「そして」の問題は、ふたつのことの ならびがちがうだけ(はんたいの ことを言う文は入れない)", () => {
    const sequences = new Set(
      build("つなぎ言葉", 3).map((problem) => /「(.+?。)（　）/.exec(problem.problemText)![1]),
    );
    expect([...sequences].every((first) => !first.includes("ぼくは えを"))).toBe(true);
  });

  it("助詞: を=なにをするか、へ=どこへ向かうか、は=ぶんの主(だれが)", () => {
    const wo = ["たべる。", "よむ。", "のむ。", "うたう。"];
    for (const level of LEVELS) {
      for (const problem of build("助詞（は・を・へ）", level)) {
        const [, , after] = /「(.*)（　） (.*)」/.exec(problem.problemText)!;
        const expected = wo.includes(after) ? "を" : after === "いく。" ? "へ" : "は";
        expect(problem.correctAnswer, problem.problemText).toBe(expected);
        if (level <= 3) expect(problem.correctAnswer).toBe(({ 1: "を", 2: "へ", 3: "は" } as const)[level as 1 | 2 | 3]);
        expect(problem.choices).toHaveLength(4);
      }
    }
  });

  it("助詞: 「は」の文は、「に」や「へ」を入れても文にならない(人にあげる意味に読めるものを使わない)", () => {
    for (const problem of build("助詞（は・を・へ）", 3)) {
      const [, before, after] = /「(.*)（　） (.*)」/.exec(problem.problemText)!;
      // 受け取る人をとれる動き(つくる・かく・よむ)の文は、「に」でも文になってしまう
      expect(after, `${before}（　） ${after}`).not.toMatch(/つくった|かいた|よんだ|よんでいる|あげた/);
    }
  });

  it("句読点: 文の おわりは「。」、話の はじまりは「「」、おわりは「」」。文は【】で囲む", () => {
    for (const level of LEVELS) {
      for (const problem of build("文の終わり（句読点）", level)) {
        const text = /【(.+)】$/.exec(problem.problemText)![1];
        const expected = text.endsWith("（　）") ? "。" : text.includes("。（　）と") ? "」" : "「";
        expect(problem.correctAnswer, problem.problemText).toBe(expected);
        expect(new Set(problem.choices)).toEqual(new Set(["。", "、", "「", "」"]));
        // 教える しるし(「」)で、問題の文そのものをかこまない
        expect(problem.problemText).not.toMatch(/ですか。「/);
      }
    }
    for (const problem of build("文の終わり（句読点）", 1)) expect(problem.correctAnswer).toBe("。");
    for (const problem of build("文の終わり（句読点）", 2)) expect(problem.correctAnswer).toBe("」");
    for (const problem of build("文の終わり（句読点）", 3)) expect(problem.correctAnswer).toBe("「");
  });
});
