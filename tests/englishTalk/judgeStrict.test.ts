import { describe, expect, it } from "vitest";
import { TALK_SCENES, getTalkTurn, type TalkTurn } from "@/lib/curriculum/englishTalkScenes";
import { judgeTalk } from "@/lib/englishTalk/judge";
import { classifyUtterance } from "@/lib/englishTalk/normalize";

const turn = (turnId: string): TalkTurn => {
  const found = getTalkTurn(turnId.split("-")[0], turnId);
  if (!found) throw new Error(`missing ${turnId}`);
  return found;
};

const voice = (turnId: string, answer: string) => judgeTalk(turn(turnId), answer, "voice").correct;

describe("classifyUtterance", () => {
  it("英語・カタカナの外来語・日本語・空を見分け、英語のトークンを取り出す", () => {
    expect(classifyUtterance("Apples, please.")).toEqual({ kind: "english", tokens: ["apples", "please"] });
    expect(classifyUtterance("ドッグ")).toEqual({ kind: "loanword", tokens: ["dog"] });
    expect(classifyUtterance("アイムファイン")).toEqual({ kind: "loanword", tokens: ["im", "fine"] });
    expect(classifyUtterance("いぬ")).toEqual({ kind: "japanese", tokens: [] });
    expect(classifyUtterance("   ")).toEqual({ kind: "empty", tokens: [] });
  });

  it("日本語が混ざっていても、英語の部分は使う(mixed)。英語の中身があれば、そのまま判定する", () => {
    expect(classifyUtterance("えっと apples please")).toEqual({ kind: "mixed", tokens: ["apples", "please"] });
    expect(voice("shop-want", "えっと apples please")).toBe(true);
  });
});

describe("judgeTalk (voice): 似た音の別名や日本語で、まちがいが通らない", () => {
  it.each([
    ["greeting-age", "Nice to meet you"],
    ["greeting-age", "Thank you for the cake"],
    ["greeting-age", "I want to go"],
    ["greeting-age", "I ate lunch"],
    ["shop-how-many", "Nice to meet you"],
    ["shop-how-many", "I want to buy it"],
    ["park-ball-color", "let me see"],
    ["park-ball-color", "I read a book"],
    ["park-ball-color", "it is a bed"],
    ["park-dog", "It's dark"],
    ["school-morning", "this is fine"],
    ["greeting-name", "I'm fine"],
    ["greeting-name", "I'm seven"],
    ["greeting-how-are-you", "I'm seven"],
  ])("%s に「%s」は不正解", (turnId, answer) => {
    expect(voice(turnId, answer)).toBe(false);
  });

  it.each([
    ["park-dog", "いぬ"],
    ["park-dog", "犬です"],
    ["shop-want", "りんごください"],
    ["shop-want", "いちご"],
    ["school-pencil", "えんぴつ"],
    ["zoo-elephant", "ぞう"],
    ["school-morning", "はい"],
    ["park-soccer", "はい"],
    ["greeting-how-are-you", "げんきです"],
  ])("%s に日本語だけの「%s」は不正解(英語で言ってもらう)", (turnId, answer) => {
    const result = judgeTalk(turn(turnId), answer, "voice");
    expect(result.correct).toBe(false);
    expect(result.needsEnglish).toBe(true);
  });
});

describe("judgeTalk (voice): これまでの正解は通り続ける", () => {
  it.each([
    ["school-morning", "Hi!"],
    ["school-morning", "Good morning"],
    ["park-dog", "ドッグ"],
    ["park-dog", "dock"],
    ["park-dog", "It's a dog."],
    ["park-ball-color", "read"],
    ["park-ball-color", "レッド"],
    ["park-ball-color", "It's red"],
    ["shop-how-many", "tree"],
    ["shop-how-many", "free"],
    ["shop-how-many", "Three, please."],
    ["greeting-age", "too"],
    ["greeting-age", "ate"],
    ["greeting-age", "to"],
    ["greeting-age", "I'm seven"],
    ["shop-here-you-are", "tank you"],
    ["shop-here-you-are", "Thank you for the apples"],
    ["greeting-how-are-you", "スリーピー"],
    ["greeting-name", "My name is Sora."],
    ["greeting-name", "I'm Yuki"],
    ["school-pencil", "ペンシル"],
    ["zoo-like", "I like pandas"],
  ])("%s に「%s」は正解", (turnId, answer) => {
    expect(voice(turnId, answer)).toBe(true);
  });

  it("どの場面でも、お手本の答えは声で言えば正解になる", () => {
    for (const scene of TALK_SCENES) {
      for (const t of scene.turns) {
        expect(judgeTalk(t, t.modelAnswer, "voice").correct, t.id).toBe(true);
      }
    }
  });
});

describe("judgeTalk (choice): 4択は選択肢の中のお手本だけが正解", () => {
  it("お手本の選択肢は正解、ほかの選択肢は不正解", () => {
    for (const scene of TALK_SCENES) {
      for (const t of scene.turns) {
        for (const choice of t.choices) {
          expect(judgeTalk(t, choice, "choice").correct, `${t.id}: ${choice}`).toBe(choice === t.modelAnswer);
        }
      }
    }
  });

  it("選択肢にない文字は、キーワードに合っていても不正解(選択肢のふりをさせない)", () => {
    const result = judgeTalk(turn("park-dog"), "dog", "choice");
    expect(result.correct).toBe(false);
    expect(result.invalidChoice).toBe(true);
  });

  it("全ターンで、お手本が選択肢の先頭にある(データの約束)", () => {
    for (const scene of TALK_SCENES) {
      for (const t of scene.turns) expect(t.choices[0], t.id).toBe(t.modelAnswer);
    }
  });
});

describe("classifyUtterance: 数字・外来語・まざった発話", () => {
  it("日本語の文字がある数字まじりの答えは、日本語として扱う(「7歳」は英語ではない)", () => {
    for (const text of ["7歳", "7さい", "3こ", "3つ", "3さつ", "ななさい"]) {
      expect(classifyUtterance(text).kind, text).toBe("japanese");
    }
  });

  it("数字だけ・英語の数字まじりは英語として扱う", () => {
    expect(classifyUtterance("7")).toEqual({ kind: "loanword", tokens: ["7"] });
    expect(classifyUtterance("7 years old").kind).toBe("english");
  });

  it("全角の英字は半角と同じ。(inaudible) などの書き起こしの印は無視する", () => {
    expect(classifyUtterance("ＤＯＧ")).toEqual({ kind: "english", tokens: ["dog"] });
    expect(classifyUtterance("(inaudible)")).toEqual({ kind: "empty", tokens: [] });
    expect(classifyUtterance("[no speech]")).toEqual({ kind: "empty", tokens: [] });
    expect(classifyUtterance("?").kind).toBe("empty");
  });

  it("短いカタカナ語は、カタカナの一続きがその語だけのときだけ英語にする(ワンちゃん・ノート・テントは英語にしない)", () => {
    expect(classifyUtterance("ハイ")).toEqual({ kind: "loanword", tokens: ["hi"] });
    expect(classifyUtterance("ワン")).toEqual({ kind: "loanword", tokens: ["one"] });
    for (const text of ["ワンちゃん", "ワンワン", "ハイキング", "ノート", "テント", "ツーリング"]) {
      expect(classifyUtterance(text).kind, text).toBe("japanese");
    }
  });

  it("英語と日本語がまざっているときは mixed。英語の部分は取り出す", () => {
    expect(classifyUtterance("It's いぬ")).toEqual({ kind: "mixed", tokens: ["its"] });
    expect(classifyUtterance("りんご please")).toEqual({ kind: "mixed", tokens: ["please"] });
  });
});

describe("judgeTalk (voice): 日本語・まざった答え・聞き取れなかった答え", () => {
  it.each([
    ["greeting-age", "7歳"],
    ["greeting-age", "ななさい"],
    ["shop-how-many", "3こ"],
    ["school-books", "3さつ"],
    ["park-dog", "It's いぬ"],
    ["shop-want", "りんご please"],
    ["zoo-elephant", "ゾウ です"],
  ])("%s に「%s」は、まちがいにせず 英語で言ってもらう", (turnId, answer) => {
    const result = judgeTalk(turn(turnId), answer, "voice");
    expect(result.correct).toBe(false);
    expect(result.needsEnglish).toBe(true);
  });

  it.each(["?", "(inaudible)", "[no speech]", "!!!"])("「%s」は聞き取れなかったこととして、もう一度言ってもらう", (answer) => {
    const result = judgeTalk(turn("park-dog"), answer, "voice");
    expect(result).toEqual({ correct: false, unclear: true });
  });

  it("名前を聞かれたときの「I'm ゆうき」は、まざっていても正解", () => {
    expect(voice("greeting-name", "I'm ゆうき")).toBe(true);
    expect(voice("greeting-name", "アイムファイン")).toBe(false);
  });
});

describe("judgeTalk: 名前のこたえ", () => {
  it.each([
    ["My name's Yuki", true],
    ["My name is Ken", true],
    ["name is Ken", true],
    ["Hello, I'm Ken", true],
    ["call me Ken", true],
    ["My name is", false],
    ["My name's", false],
    ["Your name is Kanoha", false],
    ["I'm fine", false],
    ["I'm a cat", false],
  ])("「%s」は %s", (answer, expected) => {
    expect(voice("greeting-name", answer)).toBe(expected);
  });

  it("まねして言うでも「My name's Ken」は通る", () => {
    expect(judgeTalk(turn("greeting-name"), "My name's Ken", "repeat").correct).toBe(true);
  });
});

describe("judgeTalk: ふつうに言いそうな言い方・音声認識の書き方", () => {
  it.each([
    ["park-soccer", "Yep"],
    ["park-soccer", "Sure"],
    ["park-soccer", "I do"],
    ["park-soccer", "I like soccer"],
    ["greeting-nice", "Me too"],
    ["greeting-nice", "You too"],
    ["greeting-nice", "Nice to meet ya"],
    ["greeting-how-are-you", "I'm sad"],
    ["greeting-how-are-you", "So so"],
    ["greeting-how-are-you", "Not bad"],
    ["greeting-how-are-you", "I'm find thank you"],
    ["school-morning", "Hey"],
    ["school-morning", "Goodmorning"],
    ["school-morning", "Good warning"],
    ["shop-bye", "Buy"],
    ["shop-bye", "See ya"],
    ["shop-bye", "Bye bye"],
    ["shop-how-many", "Tree apples"],
    ["shop-how-many", "7 please"],
    ["greeting-age", "I am seven"],
    ["greeting-age", "I'm 7"],
    ["school-books", "3"],
    ["zoo-like", "I like koalas"],
    ["shop-want", "Pineapples please"],
  ])("%s に「%s」は正解", (turnId, answer) => {
    expect(voice(turnId, answer)).toBe(true);
  });

  it.each([
    ["greeting-how-are-you", "Good morning"],
    ["greeting-how-are-you", "Good night"],
    ["greeting-how-are-you", "Goodbye"],
    ["greeting-how-are-you", "Nice to meet you"],
    ["park-soccer", "Nice to meet you"],
    ["school-morning", "Good night"],
  ])("%s に「%s」は不正解", (turnId, answer) => {
    expect(voice(turnId, answer)).toBe(false);
  });

  it("「Good」「I'm good」は how-are-you の正解のまま", () => {
    expect(voice("greeting-how-are-you", "Good")).toBe(true);
    expect(voice("greeting-how-are-you", "I'm good")).toBe(true);
  });
});

describe("judgeTalk (repeat): まねして言うは、お手本の言い方に近いこと", () => {
  it.each([
    ["park-dog", "It's a dog", true],
    ["park-dog", "its dog", true],
    ["park-dog", "dog", false],
    ["greeting-name", "My name is Ken", true],
    ["greeting-name", "name is Ken", false],
    ["greeting-name", "Ken", false],
    ["shop-here-you-are", "Thank you", true],
    ["shop-here-you-are", "Hello", false],
    // 音声認識は、数字を数字で・I am を I'm と書かずに・複数形を単数で書くことがある
    ["greeting-age", "I'm 7", true],
    ["greeting-age", "I am seven", true],
    ["greeting-age", "7", false],
    ["school-books", "3", true],
    ["park-ball-color", "It is red", true],
    ["park-ball-color", "it's red", true],
    ["shop-want", "Apple please", true],
    ["shop-want", "Apples, please", true],
    ["shop-bye", "Good bye", true],
    ["shop-bye", "Bye bye", true],
    ["greeting-how-are-you", "I'm find thank you", true],
    ["greeting-how-are-you", "I am fine thank you", true],
    ["greeting-how-are-you", "Fine", false],
  ])("%s を「%s」とまねしたら %s", (turnId, answer, expected) => {
    expect(judgeTalk(turn(turnId), answer, "repeat").correct).toBe(expected);
  });
});
