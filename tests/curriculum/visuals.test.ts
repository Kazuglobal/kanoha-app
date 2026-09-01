import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { GRADE_2_MATH_CURRICULUM } from "@/lib/curriculum/grade2Math";

const VISUALS_DIR = "public/visuals";

describe("unit visual templates (doc.md §19)", () => {
  it("every curriculum visualTemplate has a matching SVG in public/visuals", () => {
    for (const entry of GRADE_2_MATH_CURRICULUM) {
      expect(
        existsSync(`${VISUALS_DIR}/${entry.visualTemplate}.svg`),
        `${entry.unit} → ${entry.visualTemplate}.svg`,
      ).toBe(true);
    }
  });

  it("public/visuals contains exactly one SVG per template and no stale files", () => {
    const files = readdirSync(VISUALS_DIR).filter((file) => file.endsWith(".svg")).sort();
    const expected = [
      ...new Set(GRADE_2_MATH_CURRICULUM.map((entry) => `${entry.visualTemplate}.svg`)),
    ].sort();
    expect(files).toEqual(expected);
    expect(files).not.toContain("volume-l-ml.svg");
  });

  it("templates are child-sized flat SVGs (viewBox 400x300)", () => {
    for (const entry of GRADE_2_MATH_CURRICULUM) {
      const content = readFileSync(`${VISUALS_DIR}/${entry.visualTemplate}.svg`, "utf8");
      expect(content, entry.visualTemplate).toContain('viewBox="0 0 400 300"');
      expect(content, entry.visualTemplate).toContain("<svg");
    }
  });
});
