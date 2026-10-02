import type { SimilarProblem } from "./SimilarProblemCard";

/**
 * 子ども画面の固定文言とデモ用データ(W6)。
 * - 漢字を含む文言は必ずここに置き、tests/curriculum/rubyCoverage.test.ts が
 *   rubyDictionary で全ての漢字にルビが付くことを検証する。
 * - 文言は ひらがな中心・否定しない(CLAUDE.md 子どもUI鉄則)。
 */

/** Supabase 未設定時のデモ問題。ヒントは /api/problems/volume-1/hint(lib/ai/mock.ts)が返す。 */
export const DEMO_PROBLEM_ID = "volume-1";
export const DEMO_QUESTION = "1L は なんmL ですか？";
export const DEMO_UNIT = "かさ";
export const DEMO_VISUAL_URL = "/visuals/volume.svg";

export const DEMO_SIMILAR_PROBLEMS: readonly SimilarProblem[] = [
  { question: "2L は なんmL？", choices: ["200mL", "2000mL", "20mL", "1200mL"], answer: "2000mL", explanation: "1Lは1000mL。2こ分をかんがえよう。" },
  { question: "3000mL は なんL？", choices: ["3L", "30L", "300L", "1L"], answer: "3L", explanation: "1000mLがいくつあるか数えよう。" },
  { question: "1L と 500mL で ぜんぶで？", choices: ["1500mL", "600mL", "1050mL", "500mL"], answer: "1500mL", explanation: "1Lを1000mLになおしてたそう。" },
  { question: "4L は なんmL？", choices: ["400mL", "40mL", "4000mL", "1400mL"], answer: "4000mL", explanation: "1000mLが4こ分だよ。" },
  { question: "5000mL は なんL？", choices: ["50L", "5L", "500L", "2L"], answer: "5L", explanation: "1000mLずつに分けよう。" },
];

export const DEMO_JAPANESE_PROBLEM_ID = "kanji-1";
export const DEMO_JAPANESE_QUESTION = "つぎの 漢字の 読み方を かきましょう。「青空」";
export const DEMO_JAPANESE_UNIT = "漢字";
export const DEMO_JAPANESE_ANSWER = "あおぞら";

export const DEMO_JAPANESE_SIMILAR_PROBLEMS: readonly SimilarProblem[] = [
  { question: "「春風」の 読み方は？", choices: ["はるかぜ", "しゅんぷう", "あきかぜ", "はるあめ"], answer: "はるかぜ", explanation: "「春」と「風」で「はるかぜ」だよ。" },
  { question: "「青い」の 読み方は？", choices: ["あおい", "しろい", "くろい", "あかい"], answer: "あおい", explanation: "青い空の「あおい」だね。" },
  { question: "「青葉」の 読み方は？", choices: ["あおば", "あおは", "せいわ", "わかば"], answer: "あおば", explanation: "「青」と「葉」で「あおば」だよ。" },
  { question: "「大空」の 読み方は？", choices: ["おおぞら", "だいくう", "たいくう", "おおそら"], answer: "おおぞら", explanation: "大きな空のことで「おおぞら」と読むよ。" },
  { question: "「青空」の 読み方は？", choices: ["あおぞら", "あおそら", "せいくう", "あおぞう"], answer: "あおぞら", explanation: "「青空」は「あおぞら」と読むよ。" },
];

/** 学習フロー(LearningFlow / PracticeFlow)の固定文言。 */
export const FLOW_TEXT = Object.freeze({
  sessionStartFailed: "がくしゅうの きろくを はじめられなかったよ。",
  waitForReady: "じゅんびが おわるまで まってね。",
  hintLoadFailed: "ヒントを よみこめなかったよ。",
  answerSendFailed: "こたえを おくれなかったよ。",
  practicePrepFailed: "れんしゅうもんだいを じゅんびできなかったよ。",
  simplifyFailed: "ヒントを かんたんに できなかったよ。",
  simplified: "ヒントを もっと かんたんにしたよ。",
  visualUnavailable: "このもんだいの えは、まだ じゅんびできません。",
  retry: "もういちど ためす",
  retryFlow: "もういちど やる",
  correctFeedback: "せいかい！ よく できたね。",
  wrongFeedback: "おしい！ ヒントをつかって、ゆっくりかんがえよう。",
  answerButton: "こたえる",
  practiceButton: "れんしゅう 5もんへ",
  preparing: "じゅんびちゅう...",
  recommendedLabel: "きょうの おすすめ 1",
  coachThink: "わからないときは、ヒントを ひとつずつ みよう。",
  limitTitle: "きょうは ここまで！",
  limitCoach: "きょうも よくがんばったね。つづきは またあした！",
  limitLeadPrefix: "きょうは ",
  limitLeadSuffix: "ぷん がんばったね。",
  backHome: "ホームへ もどる",
  finishedGreat: "できた！",
  finishedRetryTitle: "もういちど やってみよう",
  finishedCoachGreat: "できた！ さいこうだよ！",
  finishedCoachTry: "さいごまで よくがんばったね！",
  finishedLeadSuffix: "を、じぶんで かんがえられたね。",
  resultLink: "きょうの けっかへ",
});

/** 子どもホーム(RealHome / DemoHome)の固定文言。 */
export const HOME_TEXT = Object.freeze({
  makeProfileTitle: "プロフィールを つくろう",
  makeProfileLead: "おうちのかたに、子どもプロフィールを作ってもらってね。",
  noProblemsLead: "まだ問題がないよ。おうちのかたに問題を追加してもらおう。",
  addProblems: "もんだいを ついかする",
  withParent: "おうちのかたと いっしょに",
  startRecommended: "きょうの おすすめを はじめる",
  review: "ふくしゅう",
  again: "もういちど",
  recommendedHeading: "きょうの おすすめ",
  noRecommendations: "おすすめ問題はまだありません。",
  coachStart: "まずは 1もん。いっしょに やろう！",
  coachWaiting: "もんだいを まっているよ！",
  heroLine2: "きょうも いっしょに",
  heroLine3: "やってみよう！",
  leadPrefix: "きょうは「",
  leadSuffix: "」の おすすめもんだい。ゆっくり かんがえれば だいじょうぶ。",
  demoAgainNote: "きのうの もんだい",
  demoReviewNote: "きょうは 1もん",
  demoStartNote: "かさ · 5〜10ぷん",
});

/** けっか画面の固定文言。 */
export const RESULT_TEXT = Object.freeze({
  coachMastered: "さいごまで できたね！",
  coachTry: "がんばったことが いちばんだよ！",
  masteredTitleSuffix: "、できた！",
  triedTitle: "きょうも よくがんばった！",
  statMastered: "できた",
  statPracticing: "れんしゅうちゅう",
  correctLabel: "せいかい",
  streakValue: "4かい",
  streakLabel: "つづいたよ",
  lead: "たんいを よくみて、さいごまで かんがえられたね。",
  home: "ホームに もどる",
  retry: "もういちど やる",
});

/** ランディング(app/page.tsx)の子どもにも見える文言。 */
export const LANDING_TEXT = Object.freeze({
  eyebrow: "まいにち 15ふん",
  titleLine1: "わかった！が",
  titleLine2: "ふえていく算数",
  lead: "かのはが、あなたにぴったりのヒントとれんしゅうをとどけるよ。",
  childMode: "子どもモードではじめる",
  parentLink: "おうちの方はこちら",
  orbLabel: "いっしょにやろう",
});

/** ルビ辞書カバレッジテストの対象になる、子ども画面の固定文言ぜんぶ。 */
export const CHILD_FIXED_STRINGS: readonly string[] = Object.freeze([
  DEMO_QUESTION,
  DEMO_UNIT,
  ...DEMO_SIMILAR_PROBLEMS.flatMap((problem) => [
    problem.question,
    ...(problem.choices ?? []),
    problem.explanation ?? "",
  ]),
  DEMO_JAPANESE_QUESTION,
  DEMO_JAPANESE_UNIT,
  ...DEMO_JAPANESE_SIMILAR_PROBLEMS.flatMap((problem) => [
    problem.question,
    ...(problem.choices ?? []),
    problem.explanation ?? "",
  ]),
  ...Object.values(FLOW_TEXT),
  ...Object.values(HOME_TEXT),
  ...Object.values(RESULT_TEXT),
  ...Object.values(LANDING_TEXT),
]);
