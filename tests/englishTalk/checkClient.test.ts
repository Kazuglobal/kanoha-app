import { afterEach, describe, expect, it, vi } from "vitest";
import { postCheck } from "@/lib/englishTalk/checkClient";

const REQUEST = { sceneId: "park", turnId: "park-dog", answer: "It's a dog.", mode: "voice" as const };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("postCheck", () => {
  it("成功したら答え合わせの結果を返す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ success: true, data: { correct: true } }));
    expect(await postCheck(REQUEST)).toEqual({ ok: true, data: { correct: true } });
  });

  it("失敗の種類を分ける: 回数の上限(429)・つながらない・サーバーのエラー", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply({ success: false }, 429));
    expect(await postCheck(REQUEST)).toEqual({ ok: false, reason: "rate_limited" });
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    expect(await postCheck(REQUEST)).toEqual({ ok: false, reason: "offline" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply({ success: false }, 500));
    expect(await postCheck(REQUEST)).toEqual({ ok: false, reason: "server" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect(await postCheck(REQUEST)).toEqual({ ok: false, reason: "server" });
  });

  it("返事が来ないときは10秒でやめて、つながらなかったことにする(画面が固まらない)", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = postCheck(REQUEST);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await pending).toEqual({ ok: false, reason: "offline" });
  });
});
