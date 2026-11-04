import { describe, expect, it } from "vitest";
import { validateGenerated } from "@/lib/generation/validate";

const HINTS = {
  hint1: "くらいを そろえて かんがえよう。",
  hint2: "いちのくらいから じゅんばんに たしてみよう。",
  solution: "いちのくらいを たして、つぎに じゅうのくらいを たすよ。",
  answer: "こたえは 68 だよ。",
  praise: "すごい！ よく できたね。",
};

const math = (overrides: Record<string, unknown> = {}) => ({
  subject: "math",
  unit: "たし算",
  subUnit: "2けたのたし算",
  level: 2,
  problemText: "23 + 45 = ?",
  correctAnswer: "68",
  hints: HINTS,
  ref: "たし算/2けたのたし算/L2/s1",
  ...overrides,
});

const english = (overrides: Record<string, unknown> = {}) => ({
  subject: "english",
  unit: "どうぶつ",
  subUnit: "どうぶつの名前",
  level: 1,
  problemText: "きこえた えいごは どれかな?",
  correctAnswer: "🐶",
  choices: ["🐶", "🐱", "🐰", "🐦"],
  listenText: "dog",
  hints: { ...HINTS, answer: "こたえは 🐶 だよ。", hint1: "おとを もういちど きいてみよう。", hint2: "どうぶつの えを おもいうかべて みよう。" },
  ref: "どうぶつ/どうぶつの名前/L1/s1",
  ...overrides,
});

const japanese = (overrides: Record<string, unknown> = {}) => ({
  subject: "japanese",
  unit: "漢字",
  subUnit: "漢字の読み",
  level: 1,
  problemText: "『山』は なんと よむ?",
  correctAnswer: "やま",
  choices: ["やま", "かわ", "うみ", "そら"],
  hints: { ...HINTS, answer: "こたえは やま だよ。", hint1: "みどりが いっぱいの ところだよ。", hint2: "とても たかい ところだよ。" },
  ref: "漢字/漢字の読み/L1/s1",
  ...overrides,
});

const issuesOf = (candidate: unknown) => validateGenerated(candidate).issues;

describe("validateGenerated: 正しい問題は通る", () => {
  it.each([
    ["算数(数字の答え)", math()],
    ["英語(聞いて選ぶ)", english()],
    ["国語(漢字の読み。かぎかっこの中の漢字はルビ不要)", japanese()],
  ])("%s", (_name, candidate) => {
    expect(validateGenerated(candidate)).toEqual({ ok: true, issues: [] });
  });

  it("単位つきの答えは、選択肢のなかで 1 つだけ一致すればよい", () => {
    const result = validateGenerated(
      math({
        subUnit: "くり上がり",
        correctAnswer: "35mm",
        choices: ["35mm", "53mm", "305mm", "3mm"],
        hints: { ...HINTS, answer: "こたえは 35mm だよ。" },
      }),
    );
    expect(result).toEqual({ ok: true, issues: [] });
  });
});

describe("validateGenerated: 形", () => {
  it("知らない項目・レベル 6・選択肢が 3 つは通さない", () => {
    expect(issuesOf({ ...math(), extra: 1 })).not.toEqual([]);
    expect(issuesOf(math({ level: 6 }))).not.toEqual([]);
    expect(issuesOf(english({ choices: ["🐶", "🐱", "🐰"] }))).not.toEqual([]);
    expect(issuesOf(null)).not.toEqual([]);
  });

  it("教科と単元が合わない・小単元が単元に無い問題は通さない", () => {
    expect(issuesOf(math({ unit: "漢字", subUnit: "漢字の読み" }))).toContainEqual(expect.stringContaining("subject"));
    expect(issuesOf(math({ subUnit: "ないしょう単元" }))).toContainEqual(expect.stringContaining("subUnit"));
  });
});

describe("validateGenerated: 選択肢", () => {
  it("同じ選択肢が 2 つあると通さない", () => {
    expect(issuesOf(english({ choices: ["🐶", "🐶", "🐰", "🐦"] }))).toContainEqual(expect.stringContaining("duplicate"));
  });

  it("答えが選択肢に入っていないと通さない", () => {
    expect(issuesOf(english({ choices: ["🐱", "🐰", "🐦", "🐟"] }))).toContainEqual(expect.stringContaining("answer"));
  });

  it("「35」と「35mm」のように、答えと同じ意味の選択肢が 2 つあると通さない", () => {
    const issues = issuesOf(math({ correctAnswer: "35mm", choices: ["35mm", "35", "53mm", "3mm"] }));
    expect(issues).toContainEqual(expect.stringContaining("answer"));
  });
});

describe("validateGenerated: 答えを先に見せない", () => {
  it("数字の答えが、問題文に そのまま出ていたら通さない", () => {
    expect(issuesOf(math({ problemText: "23 + 45 = 68 になるのは?" }))).toContainEqual(expect.stringContaining("leak"));
  });

  it("「12」の答えは、「212」の一部には反応しない(数字のかたまりで比べる)", () => {
    expect(issuesOf(math({ problemText: "212 + 1 = ?", correctAnswer: "12", hints: { ...HINTS, answer: "こたえは 12 だよ。" } }))).toEqual([]);
  });

  it("ヒント1・ヒント2に答えが出ていたら通さない(解き方・答え・ほめ言葉は よい)", () => {
    expect(issuesOf(math({ hints: { ...HINTS, hint1: "こたえは 68 かな?" } }))).toContainEqual(expect.stringContaining("leak"));
    expect(issuesOf(math({ hints: { ...HINTS, hint2: "68 になるよ。" } }))).toContainEqual(expect.stringContaining("leak"));
    expect(issuesOf(math({ hints: { ...HINTS, solution: "23 + 45 = 68 だよ。" } }))).toEqual([]);
  });

  it("かぎかっこの中は出題の材料なので、答えが入っていてもよい(ヒントは別)", () => {
    expect(
      issuesOf(
        japanese({
          unit: "文の組み立て",
          subUnit: "主語と述語",
          problemText: "「ねこが ないた。」の「どうした」にあたる ことばは どれですか。",
          correctAnswer: "ないた",
          choices: ["ないた", "ねこが", "はしった", "いぬが"],
          hints: { ...japanese().hints, answer: "こたえは ないた だよ。", hint1: "ぶんの おわりの ことばを みてみよう。", hint2: "どうしたのかを あらわす ことばだよ。" },
        }),
      ),
    ).toEqual([]);
    expect(
      issuesOf(
        japanese({
          unit: "文の組み立て",
          subUnit: "主語と述語",
          problemText: "「ねこが ないた。」の「どうした」にあたる ことばは どれですか。",
          correctAnswer: "ないた",
          choices: ["ないた", "ねこが", "はしった", "いぬが"],
          hints: { ...japanese().hints, answer: "こたえは ないた だよ。", hint1: "「ないた」だよ。" },
        }),
      ),
    ).toContainEqual(expect.stringContaining("leak"));
  });

  it("文字の答えは、2 文字以上のときだけ ヒント1・2 に出ていないか見る", () => {
    expect(issuesOf(japanese({ hints: { ...japanese().hints, hint1: "やま と よむよ。" } }))).toContainEqual(expect.stringContaining("leak"));
    // 1 文字の答え(じょし「を」)は文中の ひらがなに紛れるので、この検査の対象にしない
    expect(
      issuesOf(
        japanese({
          unit: "文の組み立て",
          subUnit: "助詞（は・を・へ）",
          problemText: "ぼくは ほん(  ) よむ。",
          correctAnswer: "を",
          choices: ["を", "へ", "の", "が"],
          hints: { ...japanese().hints, answer: "こたえは を だよ。", hint1: "なにを よむのかな?", hint2: "ものに むかう ことばだよ。" },
        }),
      ),
    ).toEqual([]);
  });
});

describe("validateGenerated: 漢字のルビ", () => {
  it("ルビ辞書にない漢字が問題文・ヒントにあると通さない", () => {
    expect(issuesOf(math({ problemText: "鬱 23 + 45 = ?" }))).toContainEqual(expect.stringContaining("ruby"));
    expect(issuesOf(math({ hints: { ...HINTS, hint1: "鬱を かんがえよう。" } }))).toContainEqual(expect.stringContaining("ruby"));
  });

  it("辞書にある熟語は通す(全部・時間)", () => {
    expect(issuesOf(math({ problemText: "全部で いくつ? 時間は?" }))).toEqual([]);
  });

  it("かぎかっこ 『』 の中の漢字は、出題の対象なので辞書になくてもよい", () => {
    expect(issuesOf(math({ problemText: "『鬱』は なんと よむ?" }))).toEqual([]);
  });
});

describe("validateGenerated: 英語", () => {
  it("カタカナ(読みがな)がまじっていたら通さない", () => {
    expect(issuesOf(english({ problemText: "『ドッグ』は どれ?" }))).toContainEqual(expect.stringContaining("katakana"));
    expect(issuesOf(english({ choices: ["🐶", "🐱", "🐰", "バード"] }))).toContainEqual(expect.stringContaining("katakana"));
  });

  it("listenText は ASCII だけ。英語の教科以外は listenText を持てない", () => {
    expect(issuesOf(english({ listenText: "いぬ" }))).toContainEqual(expect.stringContaining("listenText"));
    expect(issuesOf(math({ listenText: "dog" }))).toContainEqual(expect.stringContaining("listenText"));
  });
});

describe("validateGenerated: 文言", () => {
  it("組み立てそこない(undefined / NaN など)が文に出ていたら通さない", () => {
    expect(issuesOf(math({ problemText: "undefined + 45 = ?" }))).toContainEqual(expect.stringContaining("template"));
    expect(issuesOf(math({ hints: { ...HINTS, hint1: "NaN こ あるよ" } }))).toContainEqual(expect.stringContaining("template"));
  });

  it("否定する言葉(だめ・できない など)がヒントにあると通さない", () => {
    expect(issuesOf(math({ hints: { ...HINTS, hint2: "これは だめ だよ。" } }))).toContainEqual(expect.stringContaining("tone"));
    expect(issuesOf(math({ hints: { ...HINTS, praise: "できない かも。" } }))).toContainEqual(expect.stringContaining("tone"));
  });
});

describe("validateGenerated: 検査のすき間(レビューで見つかったもの)", () => {
  it("1 文字の答えも、それだけで ヒントに出ていたら通さない(ことばの一部は よい)", () => {
    const writing = (hint2: string) =>
      japanese({
        subUnit: "漢字の書き",
        problemText: "「やま」を かんじで かくと どれですか。",
        correctAnswer: "山",
        choices: ["山", "川", "海", "空"],
        hints: { ...japanese().hints, hint2, answer: "こたえは 『山』 だよ。" },
      });
    expect(issuesOf(writing("こたえは『山』だよ。"))).toContainEqual(expect.stringContaining("leak"));
    expect(issuesOf(writing("かたちを おもいうかべてみよう。"))).toEqual([]);
  });

  it("空白や大文字・小文字がちがう書き方でも、答えが出ていたら通さない(英数字の答え)", () => {
    const hinted = (hint2: string) => math({ correctAnswer: "3じ15ふん", hints: { ...HINTS, hint2, answer: "こたえは 3じ15ふん だよ。" } });
    expect(issuesOf(hinted("3じ 15ふん だよ。"))).toContainEqual(expect.stringContaining("leak"));
    const word = (hint1: string) =>
      english({ correctAnswer: "dog", choices: ["dog", "cat", "rabbit", "bird"], hints: { ...english().hints, hint1 } });
    expect(issuesOf(word("Dog のことだよ。"))).toContainEqual(expect.stringContaining("leak"));
    expect(issuesOf(word("どうぶつの なまえだよ。"))).toEqual([]);
  });

  it("半角カタカナの読みも、英語の問題では通さない", () => {
    expect(issuesOf(english({ problemText: "ﾄﾞｯｸﾞ は どれかな?" }))).toContainEqual(expect.stringContaining("katakana"));
  });

  it("英語の問題で選択肢がなければ通さない(英語は書かせない)", () => {
    expect(issuesOf({ ...english(), choices: undefined })).toContainEqual(expect.stringContaining("choices"));
  });

  it("問題文・選択肢の中の否定する言葉も通さない。ふつうの語(ことば・ばかり・ねむり)は よい", () => {
    expect(issuesOf(math({ problemText: "まちがえたら だめ。23 + 45 = ?" }))).toContainEqual(expect.stringContaining("tone"));
    expect(issuesOf(english({ choices: ["🐶", "🐱", "🐰", "だめ"] }))).toContainEqual(expect.stringContaining("tone"));
    const harmless = "どんな ことばかな? かたちばかり みないで、ねむりの じかんも かんがえよう。お話の ことばから よみとれたね！";
    expect(issuesOf(math({ hints: { ...HINTS, hint1: harmless } }))).toEqual([]);
  });

  it("ヒントが「はじめの字」で選択肢をひとつにしぼったら通さない(ほかにも同じ字ではじまれば よい)", () => {
    const word = (hint2: string, choices: string[]) =>
      english({ correctAnswer: "dog", choices, hints: { ...english().hints, hint2 } });
    expect(issuesOf(word("「d」から はじまる ことばだよ。", ["dog", "cat", "rabbit", "bird"]))).toContainEqual(expect.stringContaining("hint"));
    expect(issuesOf(word("「d」から はじまる ことばだよ。", ["dog", "duck", "cat", "bird"]))).toEqual([]);
  });

  it("ヒントが「○もじ」で選択肢をひとつにしぼったら通さない", () => {
    const word = (choices: string[]) =>
      english({ correctAnswer: "dog", choices, hints: { ...english().hints, hint2: "3もじの ことばだよ。" } });
    expect(issuesOf(word(["dog", "rabbit", "bird", "fish"]))).toContainEqual(expect.stringContaining("hint"));
    expect(issuesOf(word(["dog", "cat", "bird", "fish"]))).toEqual([]);
  });
});
