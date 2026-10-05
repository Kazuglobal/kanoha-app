import { describe, expect, it } from "vitest";
import { getCurriculumProblemById, getCurriculumStages } from "@/lib/curriculum/curriculumBank";
import {
  SUBJECTS,
  SUBJECT_CONFIG,
  detectSubjectFromUnit,
  getUnitsBySubject,
  resolveSubject,
} from "@/lib/curriculum/subjects";

describe("subject config (single source of truth)", () => {
  it("defines math, japanese and english", () => {
    expect([...SUBJECTS]).toEqual(["math", "japanese", "english"]);
  });

  it.each(SUBJECTS)("%s has a real default problem of the same subject and at least one stage", (subject) => {
    const config = SUBJECT_CONFIG[subject];
    expect(getCurriculumProblemById(config.defaultProblemId)?.subject).toBe(subject);
    expect(getCurriculumStages(subject).length).toBeGreaterThan(0);
    expect(getUnitsBySubject(subject)).toBe(config.units);
  });

  it("detects the subject from any unit name, defaulting to math", () => {
    expect(detectSubjectFromUnit("たし算")).toBe("math");
    expect(detectSubjectFromUnit("説明文の読解")).toBe("japanese");
    expect(detectSubjectFromUnit("作文と表現")).toBe("japanese");
    expect(detectSubjectFromUnit("どうぶつ")).toBe("english");
    expect(detectSubjectFromUnit("unknown")).toBe("math");
  });

  it("prefers a stored subject and falls back to the unit", () => {
    expect(resolveSubject("english", "たし算")).toBe("english");
    expect(resolveSubject("bogus", "文の組み立て")).toBe("japanese");
    expect(resolveSubject(null, "いろ")).toBe("english");
    expect(resolveSubject(undefined, undefined)).toBe("math");
  });

  it("uses english speech only for english", () => {
    expect(SUBJECT_CONFIG.english.speechLang).toBe("en-US");
    expect(SUBJECT_CONFIG.english.answerMode).toBe("choice");
    expect(SUBJECT_CONFIG.math.answerMode).toBe("numeric");
  });
});
