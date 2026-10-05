import { describe, expect, it } from "vitest";
import { checkDemoAnswer, demoPracticeFor } from "@/lib/curriculum/demoCheck";

const post = (body: unknown) =>
  new Request("http://localhost/api/demo/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("demo answer checking (server-side, A2)", () => {
  it("checks bank problems without exposing the answer", () => {
    expect(checkDemoAnswer("volume-1", "1000")).toEqual({ correct: true, explanation: null });
    expect(checkDemoAnswer("english-colors-1", "RED")).toEqual({ correct: true, explanation: null });
    expect(checkDemoAnswer("english-colors-1", "blue")?.correct).toBe(false);
    expect(checkDemoAnswer("unknown", "1")).toBeNull();
  });

  it("gives practice questions without answers, and explains only wrong answers", () => {
    const practice = demoPracticeFor("volume-1");
    expect(practice).toHaveLength(5);
    expect(JSON.stringify(practice)).not.toContain("answer");
    expect(checkDemoAnswer(practice[0].checkId, "2000mL")).toEqual({ correct: true, explanation: null });
    expect(checkDemoAnswer(practice[0].checkId, "200mL")?.explanation).toBeTruthy();
    expect(checkDemoAnswer("demo:volume-1:9", "1")).toBeNull();
  });

  it("builds english practice with listen text from the bank", () => {
    const practice = demoPracticeFor("english-colors-1");
    expect(practice).toHaveLength(5);
    expect(practice.every((item) => item.choices?.length === 4)).toBe(true);
  });

  it("POST /api/demo/check validates input and returns only correctness", async () => {
    const { POST } = await import("@/app/api/demo/check/route");
    expect((await POST(post({ checkId: "volume-1" }))).status).toBe(400);
    expect((await POST(post({ checkId: "nope", answer: "1" }))).status).toBe(404);
    const ok = await POST(post({ checkId: "volume-1", answer: "1000mL" }));
    expect(await ok.json()).toEqual({ success: true, data: { correct: true, explanation: null } });
  });
});
