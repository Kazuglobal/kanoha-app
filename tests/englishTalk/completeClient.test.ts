import { afterEach, describe, expect, it, vi } from "vitest";
import { newRunId, postTalkComplete } from "@/lib/englishTalk/checkClient";

const request = {
  childId: "11111111-1111-4111-8111-111111111111",
  sceneId: "park",
  runId: "22222222-2222-4222-8222-222222222222",
  outcomes: [{ turnId: "park-dog", outcome: "clean" as const }],
};

const ok = () => new Response(JSON.stringify({ success: true, data: { stars: 3, bestStars: 3, clearCount: 1 } }), { status: 200 });
const failing = (status: number) => new Response(JSON.stringify({ success: false, error: "x" }), { status });

afterEach(() => vi.restoreAllMocks());

const bodies = (spy: { mock: { calls: readonly (readonly unknown[])[] } }) => spy.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

describe("postTalkComplete: 場面のクリアをサーバーへ送る", () => {
  it("うまくいけば サーバーの結果を返す。挑戦の ID と結果をそのまま送り、タブを閉じても送れる(keepalive)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    expect(await postTalkComplete(request, { retryDelayMs: 0 })).toEqual({ stars: 3, bestStars: 3, clearCount: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("/api/english-talk/complete");
    expect(spy.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
    expect(bodies(spy)[0]).toEqual(request);
  });

  it.each([
    ["通信の失敗", () => Promise.reject(new TypeError("offline"))],
    ["サーバーの一時的な失敗(500)", () => Promise.resolve(failing(500))],
    ["サーバーの一時的な失敗(503)", () => Promise.resolve(failing(503))],
  ])("%s のときは、少し待って 1 回だけ送りなおす(同じ挑戦の ID で)", async (_name, firstReply) => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(firstReply).mockResolvedValueOnce(ok());
    expect(await postTalkComplete(request, { retryDelayMs: 0 })).toEqual({ stars: 3, bestStars: 3, clearCount: 1 });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(bodies(spy)[1]).toEqual(bodies(spy)[0]);
  });

  it.each([400, 401, 403, 404, 429])("%i は送りなおしても通らないので、送りなおさず null", async (status) => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(failing(status));
    expect(await postTalkComplete(request, { retryDelayMs: 0 })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("送りなおしも失敗したら null。3 回目は送らない", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    expect(await postTalkComplete(request, { retryDelayMs: 0 })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("返事が読めない(JSON でない)ときは null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await postTalkComplete(request, { retryDelayMs: 0 })).toBeNull();
  });
});

describe("newRunId: 挑戦ごとの ID", () => {
  it("UUID の形で、呼ぶたびに変わる", () => {
    const a = newRunId();
    const b = newRunId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
