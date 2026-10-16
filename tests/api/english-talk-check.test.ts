import { beforeEach, describe, expect, it, vi } from "vitest";

const judgeEnglishTalk = vi.fn();
const providerName = { value: "mock" as "mock" | "gemini" };

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    getAiProvider: () => ({ name: providerName.value, judgeEnglishTalk }),
  };
});

const requireOwnedChild = vi.fn();
vi.mock("@/lib/utils/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/api")>();
  return { ...actual, requireOwnedChild: (id: string) => requireOwnedChild(id) };
});

const reserveAiUsage = vi.fn();
vi.mock("@/lib/ai/usage", () => ({ reserveAiUsage: (...args: unknown[]) => reserveAiUsage(...args) }));

import { POST } from "@/app/api/english-talk/check/route";

const CHILD = "11111111-1111-4111-8111-111111111111";

const check = async (body: Record<string, unknown>) => {
  const res = await POST(
    new Request("http://localhost/api/english-talk/check", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: await res.json() };
};

describe("POST /api/english-talk/check", () => {
  beforeEach(() => {
    providerName.value = "mock";
    judgeEnglishTalk.mockReset();
    requireOwnedChild.mockReset();
    reserveAiUsage.mockReset();
  });

  it("judges a choice answer on the server without returning the answer when correct", async () => {
    const { status, json } = await check({
      sceneId: "shop",
      turnId: "shop-want",
      answer: "Apples, please.",
      mode: "choice",
    });
    expect(status).toBe(200);
    expect(json.data).toEqual({ correct: true });
  });

  it("teaches the model answer when the answer is wrong", async () => {
    const { json } = await check({
      sceneId: "park",
      turnId: "park-dog",
      answer: "It's a cat.",
      mode: "choice",
    });
    expect(json.data).toEqual({
      correct: false,
      modelAnswer: "It's a dog.",
      modelAnswerJa: "いぬだよ。",
    });
  });

  it("returns English corrective feedback when a voice answer is wrong", async () => {
    const { json } = await check({
      sceneId: "park",
      turnId: "park-dog",
      answer: "It's a cat.",
      mode: "voice",
    });
    expect(json.data).toEqual({
      correct: false,
      feedbackEn: "Close! Look closely, this is a dog! Say: It's a dog.",
      modelAnswer: "It's a dog.",
      modelAnswerJa: "いぬだよ。",
    });
  });

  it("returns isDontKnow when the user says 'I don't know' or 'わからない' by voice", async () => {
    const enRes = await check({
      sceneId: "park",
      turnId: "park-dog",
      answer: "I don't know",
      mode: "voice",
    });
    expect(enRes.json.data).toEqual({ correct: false, isDontKnow: true });

    const jaRes = await check({
      sceneId: "park",
      turnId: "park-dog",
      answer: "わからない",
      mode: "voice",
    });
    expect(jaRes.json.data).toEqual({ correct: false, isDontKnow: true });
  });

  it("rejects unknown turns and invalid input", async () => {
    expect((await check({ sceneId: "shop", turnId: "nope", answer: "a", mode: "choice" })).status).toBe(404);
    expect((await check({ sceneId: "shop", turnId: "shop-want", answer: "", mode: "choice" })).status).toBe(400);
    expect(
      (await check({ sceneId: "shop", turnId: "shop-want", answer: "a", mode: "voice", childId: "x" })).status,
    ).toBe(400);
  });

  it("does not call the AI for a child the parent does not own", async () => {
    providerName.value = "gemini";
    requireOwnedChild.mockResolvedValue({ response: new Response(null, { status: 404 }), user: null });
    const { json } = await check({
      sceneId: "zoo",
      turnId: "zoo-like",
      answer: "I love koalas",
      mode: "voice",
      childId: CHILD,
    });
    expect(requireOwnedChild).toHaveBeenCalledWith(CHILD);
    expect(judgeEnglishTalk).not.toHaveBeenCalled();
    expect(json.data.correct).toBe(false);
  });

  it("uses the AI judge for an owned child's voice answer within the cost limit", async () => {
    providerName.value = "gemini";
    requireOwnedChild.mockResolvedValue({ response: null, user: { id: "parent" }, db: {} });
    reserveAiUsage.mockResolvedValue({ outcome: "allowed", calls: 1, costUsd: 0.001 });
    judgeEnglishTalk.mockResolvedValue({ correct: true, feedback: "コアラ、いいね！" });
    const { json } = await check({
      sceneId: "zoo",
      turnId: "zoo-like",
      answer: "I love koalas",
      mode: "voice",
      childId: CHILD,
    });
    expect(json.data).toEqual({ correct: true, feedback: "コアラ、いいね！" });
  });

  it("falls back to the keyword result when the AI budget is used up or output is invalid", async () => {
    providerName.value = "gemini";
    requireOwnedChild.mockResolvedValue({ response: null, user: { id: "parent" }, db: {} });
    reserveAiUsage.mockResolvedValue({ outcome: "denied", calls: 100, costUsd: 2 });
    const denied = await check({
      sceneId: "zoo", turnId: "zoo-like", answer: "koala", mode: "voice", childId: CHILD,
    });
    expect(judgeEnglishTalk).not.toHaveBeenCalled();
    expect(denied.json.data.correct).toBe(false);

    reserveAiUsage.mockResolvedValue({ outcome: "allowed", calls: 1, costUsd: 0.001 });
    judgeEnglishTalk.mockResolvedValue({ correct: true });
    const invalid = await check({
      sceneId: "zoo", turnId: "zoo-like", answer: "koala", mode: "voice", childId: CHILD,
    });
    expect(invalid.json.data.correct).toBe(false);
  });

  it("never uses the AI for the 4-choice or repeat modes", async () => {
    providerName.value = "gemini";
    await check({ sceneId: "zoo", turnId: "zoo-like", answer: "koala", mode: "repeat", childId: CHILD });
    expect(requireOwnedChild).not.toHaveBeenCalled();
  });
});
