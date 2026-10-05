import { describe, expect, it } from "vitest";
import { resolveVisualTemplate } from "@/lib/curriculum/grade2Math";
import { GRADE_2_JAPANESE_UNITS } from "@/lib/curriculum/grade2Japanese";
import { GRADE_2_ENGLISH_UNITS } from "@/lib/curriculum/grade2English";
import { visualTemplateFor } from "@/lib/curriculum/visuals";

describe("visualTemplateFor (えで おしえて のテンプレ)", () => {
  it("returns the math template for math units", () => {
    expect(visualTemplateFor("水のかさ", "math")).toBe("volume");
    expect(visualTemplateFor("表とグラフ")).toBe("tables-and-graphs");
  });

  it.each([...GRADE_2_JAPANESE_UNITS, ...GRADE_2_ENGLISH_UNITS])(
    "never shows a math picture for %s",
    (unit) => {
      expect(visualTemplateFor(unit)).toBeNull();
    },
  );

  it("trusts the stored subject over the unit name", () => {
    expect(visualTemplateFor("水のかさ", "japanese")).toBeNull();
  });
});

describe("resolveVisualTemplate aliases", () => {
  it("does not treat every 表 or capital L as a math template", () => {
    expect(resolveVisualTemplate("作文と表現")).toBeNull();
    expect(resolveVisualTemplate("Let's sing")).toBeNull();
  });

  it("maps 長方形・正方形 to shapes, not length", () => {
    expect(resolveVisualTemplate("長方形と正方形")).toBe("shapes");
    expect(resolveVisualTemplate("長さ")).toBe("length");
  });
});
