import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getCurriculumProblemsBySubject, getCurriculumStages } from "@/lib/curriculum/curriculumBank";
import { SUBJECT_CONFIG } from "@/lib/curriculum/subjects";
import { computeStageStates } from "@/lib/curriculum/stageUnlock";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { groupSkillStates, loadPracticeInputs, loadSkillEvents, loadSolvedCurriculumIds } from "@/lib/learning/inputs";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-learning-inputs";
const CHILD = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";
const OTHER_CHILD = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const SESSION = "cccccccc-1111-4111-8111-cccccccccccc";
const OTHER_SESSION = "cccccccc-2222-4222-8222-cccccccccccc";
const T0 = Date.parse("2026-10-29T00:00:00.000Z");
const at = (minutes: number): string => new Date(T0 + minutes * 60_000).toISOString();

const db = getDb();
let counter = 0;
const uid = (prefix: string): string => `${prefix}-${(counter += 1).toString().padStart(6, "0")}-0000-4000-8000-000000000000`;

async function addProblem(overrides: Partial<typeof schema.problems.$inferInsert> = {}): Promise<string> {
  const id = uid("aaaa");
  const now = nowJstIso();
  await db
    .insert(schema.problems)
    .values({ id, childId: CHILD, problemText: "q", unit: "たし算", subUnit: "くり上がり", correctAnswer: "1", explanationJson: "{}", createdAt: now, updatedAt: now, ...overrides })
    .run();
  return id;
}

async function addAttempt(problemId: string | null, minutes: number, correct: boolean, hint = 0, extra: Partial<typeof schema.attempts.$inferInsert> = {}): Promise<void> {
  await db
    .insert(schema.attempts)
    .values({ id: uid("dddd"), sessionId: SESSION, childId: CHILD, problemId, childAnswer: "1", answerType: "tap", isCorrect: correct ? 1 : 0, hintLevelUsed: hint, createdAt: at(minutes), ...extra })
    .run();
}

beforeEach(async () => {
  const now = nowJstIso();
  await db.delete(schema.attempts).run();
  await db.delete(schema.generatedSimilarProblems).run();
  await db.delete(schema.problems).run();
  await db.delete(schema.learningSessions).run();
  await db.delete(schema.childProfiles).where(eq(schema.childProfiles.userId, USER)).run();
  await db.insert(schema.users).values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
  for (const id of [CHILD, OTHER_CHILD]) {
    await db.insert(schema.childProfiles).values({ id, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
  }
  for (const [id, childId] of [[SESSION, CHILD], [OTHER_SESSION, OTHER_CHILD]] as const) {
    await db.insert(schema.learningSessions).values({ id, childId, startedAt: now, createdAt: now, updatedAt: now }).run();
  }
});

describe("loadSkillEvents: 解いた記録を 小単元ごとの出来事に直す", () => {
  it("生成した問題はそのレベル、バンクの問題は 2、アップロードと類題は難易度から決める", async () => {
    const generated = await addProblem({ difficultyLevel: 4, generatorRef: "たし算/くり上がり/L4/s" });
    const bank = await addProblem({ unit: "ひき算", subUnit: "くり下がり", curriculumProblemId: "math-sub-1" });
    const basic = await addProblem({ difficulty: "basic" });
    const advanced = await addProblem({ difficulty: "advanced" });
    const source = await addProblem();
    const similarId = uid("eeee");
    await db.insert(schema.generatedSimilarProblems).values({ id: similarId, sourceProblemId: source, childId: CHILD, problemText: "s", answer: "1", explanation: "e", unit: "かけ算", subUnit: "九九", difficulty: "advanced", createdAt: nowJstIso() }).run();
    await addAttempt(generated, 1, true);
    await addAttempt(bank, 2, true);
    await addAttempt(basic, 3, false);
    await addAttempt(advanced, 4, true);
    await addAttempt(null, 5, true, 0, { similarProblemId: similarId });

    const events = await loadSkillEvents(db, CHILD);
    expect(events.map((event) => [event.unit, event.subUnit, event.level, event.correct])).toEqual([
      ["たし算", "くり上がり", 4, true],
      ["ひき算", "くり下がり", 2, true],
      ["たし算", "くり上がり", 1, false],
      ["たし算", "くり上がり", 4, true],
      ["かけ算", "九九", 4, true],
    ]);
  });

  it("答えが書かれた「ときかた」(3)以上のヒントを見てからの正解は、答えを見たあととして数える", async () => {
    const problem = await addProblem({ difficultyLevel: 2 });
    await addAttempt(problem, 1, true, 0);
    await addAttempt(problem, 2, true, 2);
    await addAttempt(problem, 3, true, 3);
    await addAttempt(problem, 4, true, 4);
    const events = await loadSkillEvents(db, CHILD);
    expect(events.map((event) => event.usedAnswerHint)).toEqual([false, false, true, true]);
  });

  it("時刻は エポックミリ秒。ほかの子の記録・問題が消えた記録は入らない", async () => {
    const mine = await addProblem({ difficultyLevel: 3 });
    await addAttempt(mine, 10, true);
    const other = await addProblem({ childId: OTHER_CHILD, difficultyLevel: 3 });
    await db.insert(schema.attempts).values({ id: uid("dddd"), sessionId: OTHER_SESSION, childId: OTHER_CHILD, problemId: other, childAnswer: "1", answerType: "tap", isCorrect: 1, hintLevelUsed: 0, createdAt: at(11) }).run();
    const gone = await addProblem({ difficultyLevel: 3 });
    await addAttempt(gone, 12, true);
    await db.delete(schema.problems).where(eq(schema.problems.id, gone)).run();

    const events = await loadSkillEvents(db, CHILD);
    expect(events).toHaveLength(1);
    expect(events[0].at).toBe(T0 + 10 * 60_000);
  });

  it("教科の単元でしぼってから 新しい 300 件を読む(ほかの教科をたくさん解いても、この教科の記録は押し出されない)", async () => {
    const math = await addProblem({ difficultyLevel: 5, unit: "たし算", subUnit: "くり上がり" });
    await addAttempt(math, 1, true);
    const english = await addProblem({ subject: "english", unit: "あいさつ", subUnit: "朝と昼のあいさつ", difficultyLevel: 2 });
    for (let index = 0; index < 305; index += 1) await addAttempt(english, 10 + index, true);

    const mathEvents = await loadSkillEvents(db, CHILD, SUBJECT_CONFIG.math.units);
    expect(mathEvents.map((event) => [event.unit, event.level])).toEqual([["たし算", 5]]);
    expect(await loadSkillEvents(db, CHILD)).toHaveLength(300);
    const inputs = await loadPracticeInputs(db, CHILD, "math", new Date(T0 + 24 * 60 * 60_000));
    expect(inputs.states.map((state) => `${state.unit}/${state.subUnit}`)).toEqual(["たし算/くり上がり"]);
    expect(inputs.states[0].level).toBe(2);
  });

  it("自動で作った問題の類題は 元の問題のレベルで数える(3 段階の難易度に丸めると L3 が 2、L5 が 4 に読めてしまう)", async () => {
    const source3 = await addProblem({ difficultyLevel: 3, generatorRef: "たし算/くり上がり/L3/x" });
    const source5 = await addProblem({ difficultyLevel: 5, generatorRef: "ひき算/くり下がり/L5/x", unit: "ひき算", subUnit: "くり下がり" });
    const bankSource = await addProblem({ curriculumProblemId: "math-bank-1", unit: "かけ算", subUnit: "九九" });
    const similar = async (id: string, sourceProblemId: string, unit: string, subUnit: string, difficulty: string) =>
      db.insert(schema.generatedSimilarProblems).values({ id, sourceProblemId, childId: CHILD, problemText: "s", answer: "1", explanation: "e", unit, subUnit, difficulty, createdAt: nowJstIso() }).run();
    await similar("sim-3", source3, "たし算", "くり上がり", "standard");
    await similar("sim-5", source5, "ひき算", "くり下がり", "advanced");
    await similar("sim-bank", bankSource, "かけ算", "九九", "advanced");
    await addAttempt(null, 1, true, 0, { similarProblemId: "sim-3" });
    await addAttempt(null, 2, true, 0, { similarProblemId: "sim-5" });
    await addAttempt(null, 3, true, 0, { similarProblemId: "sim-bank" });
    const events = await loadSkillEvents(db, CHILD);
    // 自動で作った問題の類題は元のレベル、バンクの問題の類題は これまでどおり難易度(advanced = 4)
    expect(events.map((event) => event.level)).toEqual([3, 5, 4]);
  });

  it("新しい 300 件までを読む", async () => {
    const problem = await addProblem({ difficultyLevel: 2 });
    for (let index = 0; index < 305; index += 1) await addAttempt(problem, index, index % 2 === 0);
    const events = await loadSkillEvents(db, CHILD);
    expect(events).toHaveLength(300);
    expect(Math.min(...events.map((event) => event.at))).toBe(T0 + 5 * 60_000);
  });
});

describe("groupSkillStates: 小単元ごとのレベルとようす", () => {
  const event = (unit: string, subUnit: string, minutes: number, correct: boolean, level = 2) => ({ unit, subUnit, level, correct, usedAnswerHint: false, at: T0 + minutes * 60_000 });

  it("小単元ごとに まとめて、レベルとようすを求める(古い順でなくてもよい)", () => {
    const states = groupSkillStates(
      [
        event("たし算", "くり上がり", 3, true),
        event("たし算", "くり上がり", 1, true),
        event("たし算", "くり上がり", 2, true),
        event("ひき算", "くり下がり", 1, false),
        event("ひき算", "くり下がり", 2, false),
      ],
      T0 + 10 * 60_000,
    );
    const byKey = new Map(states.map((state) => [`${state.unit}/${state.subUnit}`, state]));
    expect(byKey.get("たし算/くり上がり")).toMatchObject({ level: 3, status: "steady", attempts: 3 });
    expect(byKey.get("ひき算/くり下がり")).toMatchObject({ level: 1, attempts: 2 });
  });

  it("出来事がなければ空", () => {
    expect(groupSkillStates([], T0)).toEqual([]);
  });
});

describe("loadSolvedCurriculumIds: ステージマップで一度でも正解した問題バンクの id", () => {
  it("正解した問題バンクの問題だけを、重ならずに返す", async () => {
    const bankA = await addProblem({ curriculumProblemId: "bank-a" });
    const bankB = await addProblem({ curriculumProblemId: "bank-b" });
    const generated = await addProblem({ difficultyLevel: 2 });
    await addAttempt(bankA, 1, true);
    await addAttempt(bankA, 2, true);
    await addAttempt(bankB, 3, false);
    await addAttempt(generated, 4, true);
    expect(await loadSolvedCurriculumIds(db, CHILD)).toEqual(["bank-a"]);
  });
});

describe("loadPracticeInputs: 出題計画に渡す材料", () => {
  const math = getCurriculumProblemsBySubject("math");

  it("states はその教科の小単元だけ", async () => {
    const math1 = await addProblem({ unit: "たし算", subUnit: "くり上がり", difficultyLevel: 2 });
    const english = await addProblem({ subject: "english", unit: "あいさつ", subUnit: "朝と昼のあいさつ", difficultyLevel: 2 });
    await addAttempt(math1, 1, true);
    await addAttempt(english, 2, true);
    const inputs = await loadPracticeInputs(db, CHILD, "math", new Date(T0 + 60_000));
    expect(inputs.states.map((state) => `${state.unit}/${state.subUnit}`)).toEqual(["たし算/くり上がり"]);
  });

  it("解放ずみ・まだの単元は、解いたバンク問題の数から決まる(ステージマップと同じ計算)", async () => {
    const stages = getCurriculumStages("math");
    const solved = math.slice(0, 7).map((problem) => problem.id);
    for (const [index, id] of solved.entries()) {
      const row = await addProblem({ curriculumProblemId: id });
      await addAttempt(row, index, true);
    }
    const summary = computeStageStates(stages, solved);
    const inputs = await loadPracticeInputs(db, CHILD, "math", new Date(T0 + 60 * 60_000));
    expect(inputs.unlockedUnits).toEqual(summary.stages.filter((state) => state.unlocked).map((state) => state.stage.unit));
    const locked = summary.stages.filter((state) => !state.unlocked).sort((a, b) => a.stage.unlockRequirement - b.stage.unlockRequirement);
    expect(inputs.lockedUnits).toEqual(locked.map((state) => state.stage.unit));
  });

  it("バンクの候補は、解放ずみの単元の まだ解いていない問題だけ", async () => {
    const solved = math[0];
    const row = await addProblem({ curriculumProblemId: solved.id });
    await addAttempt(row, 1, true);
    const inputs = await loadPracticeInputs(db, CHILD, "math", new Date(T0 + 60_000));
    const unlocked = new Set(inputs.unlockedUnits);
    expect(inputs.bank.length).toBeGreaterThan(0);
    expect(inputs.bank.map((entry) => entry.id)).not.toContain(solved.id);
    for (const entry of inputs.bank) {
      expect(unlocked.has(entry.unit), entry.id).toBe(true);
      expect(math.find((problem) => problem.id === entry.id), entry.id).toMatchObject({ unit: entry.unit, subUnit: entry.subUnit });
    }
  });

  it("答えはどこにも入らない(材料は 単元・小単元・id だけ)", async () => {
    const inputs = await loadPracticeInputs(db, CHILD, "math", new Date(T0));
    expect(JSON.stringify(inputs)).not.toMatch(/correctAnswer|hint1|solution/);
  });
});
