import "server-only";
import { GREETINGS, NAMES, POLITE_PHRASES } from "@/lib/curriculum/englishWords";
import { pickOne } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../helpers";
import type { GeneratorEntry } from "../types";

const UNIT = "あいさつ";
// 教科ごとの固定ヒント(subjects.ts)と同じ文にしない(答えのソースの文が、ブラウザ向け JS に入っていないかを調べているため)
const LISTEN_AGAIN = "おとを ゆっくり きいてみよう。";
const LISTEN_PROMPT = "えいごを きいて、";

type Random = () => number;
type Build = (random: Random) => ProblemSpec;
type Builders = Readonly<Record<SpecContext["level"], Build>>;

const TIME_HINT = "あさ・ひる・ゆうがた・よるの どれかな?";

// ---- 朝・昼・夕・夜のあいさつ ----

const timeGreeting = (kind: "picture" | "japanese" | "fromPicture" | "fromScene" | "fromJapanese"): Build => (random) => {
  const item = pickOne(random, GREETINGS);
  const others = GREETINGS.filter((greeting) => greeting.en !== item.en);
  const listen = { listenText: item.en, hint1: LISTEN_AGAIN };
  switch (kind) {
    case "picture":
      return { ...listen, problemText: `${LISTEN_PROMPT}あう えを えらぼう。`, answer: item.emoji!, wrong: others.map((greeting) => greeting.emoji!), hint2: "あさ・ひる・ゆうがた・よるの えを おもいうかべよう。", solution: `「${item.en}」は ${item.ja} だよ。` };
    case "japanese":
      return { ...listen, problemText: `${LISTEN_PROMPT}あう ことばを えらぼう。`, answer: item.ja, wrong: others.map((greeting) => greeting.ja), hint2: TIME_HINT, solution: `「${item.en}」は ${item.ja} だよ。` };
    default: {
      const question =
        kind === "fromPicture" ? `${item.emoji} の ときの あいさつは えいごで どれですか。` : kind === "fromScene" ? `${item.situation}の あいさつは えいごで どれですか。` : `「${item.ja}」は えいごで どれですか。`;
      return { problemText: question, answer: item.en, wrong: others.map((greeting) => greeting.en), hint1: "いつの あいさつか かんがえよう。", hint2: TIME_HINT, solution: `${item.ja} は えいごで「${item.en}」だよ。` };
    }
  }
};

const TIME_BUILDERS: Builders = {
  1: timeGreeting("picture"),
  2: timeGreeting("japanese"),
  3: timeGreeting("fromPicture"),
  4: timeGreeting("fromScene"),
  5: timeGreeting("fromJapanese"),
};

// ---- おれい・おわびと、おわかれ ----

const POLITE_HINTS = { hint1: LISTEN_AGAIN, hint2: "どんな ときに つかう ことばか かんがえよう。" };
const SITUATION_HINTS = { hint1: "どんな ときに つかう ことばなのか かんがえよう。", hint2: "えいごの おとを おもいだしてみよう。" };

/** 同じ場面で どちらも使える ことば(group が同じ)は、まちがいの選択肢にいっしょに出さない。 */
const otherGroups = (group: string) => POLITE_PHRASES.filter((phrase) => phrase.group !== group);

const politeFrom = (kind: "japanese" | "situationChoice" | "toEnglishFromJapanese" | "toEnglishFromSituation"): Build => (random) => {
  const item = pickOne(random, POLITE_PHRASES);
  const others = otherGroups(item.group);
  switch (kind) {
    case "japanese":
      return { ...POLITE_HINTS, problemText: `${LISTEN_PROMPT}あう ことばを えらぼう。`, listenText: item.en, answer: item.ja, wrong: others.map((phrase) => phrase.ja), solution: `「${item.en}」は ${item.ja} だよ。` };
    case "situationChoice":
      return { ...POLITE_HINTS, problemText: `${LISTEN_PROMPT}つかう ときを えらぼう。`, listenText: item.en, answer: item.situation, wrong: others.map((phrase) => phrase.situation), solution: `「${item.en}」は ${item.situation} に つかうよ。` };
    case "toEnglishFromJapanese":
      return { ...SITUATION_HINTS, problemText: `「${item.ja}」は えいごで どれですか。`, answer: item.en, wrong: others.map((phrase) => phrase.en), solution: `${item.ja} は えいごで「${item.en}」だよ。` };
    default:
      return { ...SITUATION_HINTS, problemText: `${item.situation}、えいごで なんと いいますか。`, answer: item.en, wrong: others.map((phrase) => phrase.en), solution: `${item.ja} は えいごで「${item.en}」だよ。` };
  }
};

const politeReply: Build = (random) => {
  const item = pickOne(random, POLITE_PHRASES.filter((phrase) => phrase.reply));
  return {
    problemText: `${LISTEN_PROMPT}あう へんじを えらぼう。`,
    listenText: item.en,
    answer: item.reply!,
    wrong: item.wrongReplies ?? [],
    hint1: LISTEN_AGAIN,
    hint2: "いわれた ことばに あう こたえを かんがえよう。",
    solution: `「${item.en}」と いわれたら「${item.reply}」と こたえるよ。`,
  };
};

const POLITE_BUILDERS: Builders = {
  1: politeFrom("japanese"),
  2: politeFrom("toEnglishFromJapanese"),
  3: politeFrom("situationChoice"),
  4: politeFrom("toEnglishFromSituation"),
  5: politeReply,
};

// ---- 名前をつたえる ----

const nameReply = (name: string): string => `My name is ${name}.`;
const ANSWER_HINT = "きかれた ことに あう こたえを えらぼう。";

/** 聞いた問いと、あう こたえ・あわない こたえ。名前の文は「Nice to meet you.」のへんじには出さない。 */
const askYourName = (name: string) => ({ listen: "What's your name?", answer: nameReply(name), wrong: ["I'm fine, thank you.", "Nice to meet you, too.", "It's red.", "I like apples."] });
const askHowAreYou = (name: string) => ({ listen: "How are you?", answer: "I'm fine, thank you.", wrong: [nameReply(name), "Nice to meet you, too.", "It's red.", "I like apples."] });
const askNiceToMeetYou = () => ({ listen: "Nice to meet you.", answer: "Nice to meet you, too.", wrong: ["Good night.", "I'm fine, thank you.", "It's red.", "I'm seven."] });

const replyTo = (question: { listen: string; answer: string; wrong: readonly string[] }, hint: string): ProblemSpec => ({
  problemText: `${LISTEN_PROMPT}あう こたえを えらぼう。`,
  listenText: question.listen,
  answer: question.answer,
  wrong: question.wrong,
  hint1: LISTEN_AGAIN,
  hint2: hint,
  solution: `「${question.listen}」には「${question.answer}」と こたえるよ。`,
});

const nameQuestion: Build = (random) => replyTo(askYourName(pickOne(random, NAMES)), "なまえを きかれているよ。");
const howAreYou: Build = (random) => replyTo(askHowAreYou(pickOne(random, NAMES)), "げんきか どうかを きかれているよ。");
const niceToMeetYou: Build = () => replyTo(askNiceToMeetYou(), "はじめて あった ときの あいさつだよ。");

const hearName: Build = (random) => {
  const name = pickOne(random, NAMES);
  return {
    problemText: `${LISTEN_PROMPT}なまえを えらぼう。`,
    listenText: nameReply(name),
    answer: name,
    wrong: NAMES.filter((candidate) => candidate !== name),
    hint1: LISTEN_AGAIN,
    hint2: "「My name is」の あとの ことばが なまえだよ。",
    solution: `なまえは「${name}」だよ。`,
  };
};

/** 3 つの問いの どれが聞こえるか分からない(聞きわけて こたえる)。 */
const anyQuestion: Build = (random) => {
  const name = pickOne(random, NAMES);
  const question = pickOne(random, [askYourName(name), askHowAreYou(name), askNiceToMeetYou()]);
  return { ...replyTo(question, ANSWER_HINT), hint1: "なにを きかれているか、よく きいてみよう。" };
};

const NAME_BUILDERS: Builders = { 1: nameQuestion, 2: hearName, 3: howAreYou, 4: niceToMeetYou, 5: anyQuestion };

const entry = (subUnit: string, builders: Builders, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  specEntry({ subject: "english", unit: UNIT, subUnit, levels }, ({ level, random }) => builders[level](random));

export const ENGLISH_PHRASE_GENERATORS: readonly GeneratorEntry[] = [
  entry("朝と昼のあいさつ", TIME_BUILDERS, {
    1: "きいて えを えらぶ",
    2: "きいて 日本語を えらぶ",
    3: "えを見て 英語を えらぶ",
    4: "場面から 英語を えらぶ",
    5: "日本語から 英語を えらぶ",
  }),
  entry("おれいとおわかれ", POLITE_BUILDERS, {
    1: "きいて 日本語を えらぶ",
    2: "日本語から 英語を えらぶ",
    3: "きいて つかう場面を えらぶ",
    4: "場面から 英語を えらぶ",
    5: "きいて へんじを えらぶ",
  }),
  entry("名前をつたえる", NAME_BUILDERS, {
    1: "「What's your name?」に こたえる",
    2: "きいて なまえを えらぶ",
    3: "「How are you?」に こたえる",
    4: "「Nice to meet you.」に こたえる",
    5: "3つの問いのどれかを聞きわけて こたえる",
  }),
];

