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
      answer: "I love axolotls",
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
    judgeEnglishTalk.mockResolvedValue({ correct: true, feedback: "ウーパールーパー、いいね！" });
    const { json } = await check({
      sceneId: "zoo",
      turnId: "zoo-like",
      answer: "I love axolotls",
      mode: "voice",
      childId: CHILD,
    });
    expect(json.data).toEqual({ correct: true, feedback: "ウーパールーパー、いいね！" });
  });

  it("falls back to the keyword result when the AI budget is used up or output is invalid", async () => {
    providerName.value = "gemini";
    requireOwnedChild.mockResolvedValue({ response: null, user: { id: "parent" }, db: {} });
    reserveAiUsage.mockResolvedValue({ outcome: "denied", calls: 100, costUsd: 2 });
    const denied = await check({
      sceneId: "zoo", turnId: "zoo-like", answer: "axolotl", mode: "voice", childId: CHILD,
    });
    expect(judgeEnglishTalk).not.toHaveBeenCalled();
    expect(denied.json.data.correct).toBe(false);

    reserveAiUsage.mockResolvedValue({ outcome: "allowed", calls: 1, costUsd: 0.001 });
    judgeEnglishTalk.mockResolvedValue({ correct: true });
    const invalid = await check({
      sceneId: "zoo", turnId: "zoo-like", answer: "axolotl", mode: "voice", childId: CHILD,
    });
    expect(invalid.json.data.correct).toBe(false);
  });

  it("never uses the AI for the 4-choice or repeat modes", async () => {
    providerName.value = "gemini";
    await check({ sceneId: "zoo", turnId: "zoo-like", answer: "axolotl", mode: "repeat", childId: CHILD });
    expect(requireOwnedChild).not.toHaveBeenCalled();
    // 4択は、選択肢にない文字なら 400、選択肢のまちがいなら まちがい。どちらも AI は呼ばない
    const notAChoice = await check({ sceneId: "zoo", turnId: "zoo-like", answer: "axolotl", mode: "choice", childId: CHILD });
    expect(notAChoice.status).toBe(400);
    const wrongChoice = await check({
      sceneId: "zoo", turnId: "zoo-like", answer: "I'm fine.", mode: "choice", childId: CHILD,
    });
    expect(wrongChoice.json.data.correct).toBe(false);
    expect(requireOwnedChild).not.toHaveBeenCalled();
    expect(judgeEnglishTalk).not.toHaveBeenCalled();
  });
});

describe("POST /api/english-talk/check: stricter judging", () => {
  beforeEach(() => {
    providerName.value = "mock";
    judgeEnglishTalk.mockReset();
    requireOwnedChild.mockReset();
    reserveAiUsage.mockReset();
  });

  const allowAi = () => {
    providerName.value = "gemini";
    requireOwnedChild.mockResolvedValue({ response: null, user: { id: "parent" }, db: {} });
    reserveAiUsage.mockResolvedValue({ outcome: "allowed", calls: 1, costUsd: 0.001 });
    judgeEnglishTalk.mockResolvedValue({ correct: true, feedback: "いいね！" });
  };

  it("rejects a 4-choice answer that is not one of the choices (it cannot pass for a keyword match)", async () => {
    const { status } = await check({ sceneId: "park", turnId: "park-dog", answer: "dog", mode: "choice" });
    expect(status).toBe(400);
  });

  it.each(["?", "(inaudible)", "[no speech]"])(
    "聞き取れなかった印(%s)は、まちがいにも ごほうびにもせず もう一度言ってもらう",
    async (answer) => {
      const { json } = await check({ sceneId: "park", turnId: "park-dog", answer, mode: "voice", firstTry: true });
      expect(json.data).toEqual({ correct: false, unclear: true });
    },
  );

  it("asks for English when the voice answer is only Japanese, without teaching or marking it wrong", async () => {
    const { json } = await check({ sceneId: "park", turnId: "park-dog", answer: "いぬ", mode: "voice" });
    expect(json.data).toEqual({ correct: false, needsEnglish: true });
  });

  it("does not accept a sound-alike word inside an unrelated sentence", async () => {
    const { json } = await check({ sceneId: "greeting", turnId: "greeting-age", answer: "Nice to meet you", mode: "voice" });
    expect(json.data.correct).toBe(false);
    expect(json.data.modelAnswer).toBe("I'm seven.");
  });

  it("accepts a fruit context and rejects one that is not a known fruit", async () => {
    const ok = await check({
      sceneId: "shop", turnId: "shop-how-many", answer: "Three, please.", mode: "voice", context: { fruit: "banana" },
    });
    expect(ok.status).toBe(200);
    expect(ok.json.data.correct).toBe(true);
    const bad = await check({
      sceneId: "shop", turnId: "shop-how-many", answer: "Three", mode: "voice", context: { fruit: "<script>" },
    });
    expect(bad.status).toBe(400);
  });

  it("uses the AI judge only for turns marked open, never for the name question", async () => {
    allowAi();
    const name = await check({
      sceneId: "greeting", turnId: "greeting-name", answer: "my friend is Taro", mode: "voice", childId: CHILD,
    });
    expect(name.json.data.correct).toBe(false);
    const dog = await check({
      sceneId: "park", turnId: "park-dog", answer: "it is an axolotl", mode: "voice", childId: CHILD,
    });
    expect(dog.json.data.correct).toBe(false);
    expect(judgeEnglishTalk).not.toHaveBeenCalled();
    expect(reserveAiUsage).not.toHaveBeenCalled();
  });

  it("does not send a Japanese-only or empty-of-English answer to the AI judge", async () => {
    allowAi();
    const { json } = await check({
      sceneId: "zoo", turnId: "zoo-like", answer: "コアラがすき", mode: "voice", childId: CHILD,
    });
    expect(json.data).toEqual({ correct: false, needsEnglish: true });
    expect(judgeEnglishTalk).not.toHaveBeenCalled();
  });

  it("reads the AI cost from the environment on every request", async () => {
    allowAi();
    const original = process.env.AI_ENGLISH_TALK_COST_USD;
    process.env.AI_ENGLISH_TALK_COST_USD = "0.002";
    try {
      await check({ sceneId: "zoo", turnId: "zoo-like", answer: "I love axolotls", mode: "voice", childId: CHILD });
      expect(reserveAiUsage.mock.calls[0][1]).toBe(0.002);
    } finally {
      if (original === undefined) delete process.env.AI_ENGLISH_TALK_COST_USD;
      else process.env.AI_ENGLISH_TALK_COST_USD = original;
    }
  });
});
