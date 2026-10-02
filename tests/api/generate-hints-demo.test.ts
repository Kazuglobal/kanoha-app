import { describe, expect, it } from "vitest";
import { POST as generateHintsPost } from "@/app/api/ai/generate-hints/route";
import { POST as generateImagePost } from "@/app/api/ai/generate-image/route";

describe("Demo and Curriculum Bank support in AI endpoints", () => {
  it("successfully generates simplified hints for demo/curriculum math problem", async () => {
    const req = new Request("http://localhost/api/ai/generate-hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: "demo",
        problemId: "volume-1",
        sessionId: "demo-session",
        explanationLevel: "very_easy",
      }),
    });

    const res = await generateHintsPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.hint1).toBeDefined();
    expect(data.data.hint2).toBeDefined();
    expect(data.data.solution).toBeDefined();
  });

  it("successfully generates simplified hints for demo/curriculum japanese problem", async () => {
    const req = new Request("http://localhost/api/ai/generate-hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: "demo",
        problemId: "kanji-1",
        sessionId: "demo-session",
        explanationLevel: "very_easy",
      }),
    });

    const res = await generateHintsPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.hint1).toBeDefined();
  });

  it("returns template visual hint for demo problem", async () => {
    const req = new Request("http://localhost/api/ai/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: "demo",
        problemId: "volume-1",
        requestedByChild: true,
      }),
    });

    const res = await generateImagePost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.kind).toBe("template");
    expect(data.data.url).toContain("/visuals/volume.svg");
  });

  it("returns 404 for unknown demo problem id in generate-hints", async () => {
    const req = new Request("http://localhost/api/ai/generate-hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId: "demo",
        problemId: "nonexistent-9999",
        sessionId: "demo-session",
        explanationLevel: "very_easy",
      }),
    });

    const res = await generateHintsPost(req);
    expect(res.status).toBe(404);
  });
});
