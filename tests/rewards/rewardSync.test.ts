import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EQUIPPED, getEquippedAccessories, saveEquippedAccessories } from "@/lib/rewards/characterGrowthStore";
import {
  flushEquippedSave,
  getActiveChildId,
  queueEquippedSave,
  saveEquippedToServer,
  syncRewardsFromServer,
} from "@/lib/rewards/rewardSync";
import { applyServerReward, getRewardState, saveRewardState } from "@/lib/rewards/rewardStore";

const CHILD_A = "11111111-1111-4111-8111-111111111111";
const CHILD_B = "22222222-2222-4222-8222-222222222222";

const serverData = (totalCorrectCount: number, stored = true) => ({
  reward: { currentCycleCount: totalCorrectCount % 10, totalCorrectCount, totalRewardYen: Math.floor(totalCorrectCount / 10) * 5 },
  equipped: { hat: "hat_safari", glasses: "glasses_none", gloves: "gloves_none", clothes: "clothes_tshirt" },
  stored,
});

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

describe("rewardSync", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("replaces the device cache with the child's server state", async () => {
    saveRewardState({ currentCycleCount: 0, totalCorrectCount: 0, totalRewardYen: 0 });
    fetchMock.mockResolvedValueOnce(ok(serverData(12)));

    expect(await syncRewardsFromServer(CHILD_A)).toBe(true);
    expect(getRewardState()).toMatchObject({ totalCorrectCount: 12, totalRewardYen: 5 });
    expect(getEquippedAccessories().hat).toBe("hat_safari");
    expect(getActiveChildId()).toBe(CHILD_A);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("imports legacy device rewards once, never into a sibling afterwards", async () => {
    saveRewardState({ currentCycleCount: 7, totalCorrectCount: 7, totalRewardYen: 0 });
    fetchMock
      .mockResolvedValueOnce(ok(serverData(0, false)))
      .mockResolvedValueOnce(ok({ ...serverData(7), imported: true }));

    await syncRewardsFromServer(CHILD_A);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(getRewardState().totalCorrectCount).toBe(7);

    // きょうだいを開いても、キャッシュ(A の値)を B へ取り込まない
    fetchMock.mockResolvedValueOnce(ok(serverData(0, false)));
    await syncRewardsFromServer(CHILD_B);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getRewardState().totalCorrectCount).toBe(0);
  });

  it("keeps the device display when the server is unreachable", async () => {
    saveRewardState({ currentCycleCount: 3, totalCorrectCount: 3, totalRewardYen: 0 });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await syncRewardsFromServer(CHILD_A)).toBe(false);
    expect(getRewardState().totalCorrectCount).toBe(3);
  });

  it("ignores invalid child ids", async () => {
    expect(await syncRewardsFromServer("not-a-uuid")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("saving the dress-up", () => {
    const outfit = { hat: "hat_safari", effect: "effect_sparkle" };
    const full = { ...DEFAULT_EQUIPPED, ...outfit };
    const sentBody = (call: number) => JSON.parse(String(fetchMock.mock.calls[call][1].body));
    const urlOf = (call: number) => String(fetchMock.mock.calls[call][0]);
    const pendingOf = (childId: string) => JSON.parse(localStorage.getItem(`kanoha_equipped_pending_v1:${childId}`) ?? "{}");
    const respond = (equipped: unknown, rejected: string[] = []) => ok({ ...serverData(0), equipped, rejected });
    const status = (code: number) => new Response(JSON.stringify({ success: false, error: "x" }), { status: code });

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(ok(serverData(0)));
      await syncRewardsFromServer(CHILD_B);
      fetchMock.mockClear();
    });

    afterEach(async () => {
      fetchMock.mockResolvedValue(respond(full)); // 待っている分が残っていても、次のテストに持ち越さない
      await flushEquippedSave();
      vi.useRealTimers();
    });

    it("puts only the changed slots to the child it was made for, in one request", async () => {
      fetchMock.mockResolvedValueOnce(respond(full));
      const result = await saveEquippedToServer(CHILD_B, outfit);

      expect(result).toMatchObject({ status: "saved", rejected: [] });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(urlOf(0)).toBe(`/api/children/${CHILD_B}/rewards`);
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT", keepalive: true });
      expect(sentBody(0)).toEqual({ equipped: outfit });
      expect(pendingOf(CHILD_B)).toEqual({}); // 受け取られたので 保存待ちは空
    });

    it("puts a slot the server refused back to what the server has, and keeps the rest", async () => {
      saveEquippedAccessories(full);
      fetchMock.mockResolvedValueOnce(respond({ ...full, effect: "effect_none" }, ["effect"]));
      const result = await saveEquippedToServer(CHILD_B, outfit);

      expect(result).toMatchObject({ status: "saved", rejected: ["effect"] });
      expect(getEquippedAccessories()).toMatchObject({ hat: "hat_safari", effect: "effect_none" });
      expect(pendingOf(CHILD_B)).toEqual({}); // 着られない枠を いつまでも送り直さない
    });

    it("only keeps the device copy when no child is open (demo)", async () => {
      const result = await saveEquippedToServer(null, outfit);
      expect(result.status).toBe("local");
      queueEquippedSave(null, outfit);
      await flushEquippedSave();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(Object.keys(localStorage).filter((key) => key.startsWith("kanoha_equipped_pending_v1"))).toEqual([]);
    });

    it("sends one request with every slot changed in a burst (the last choice wins for the same slot)", async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(respond(full));
      const onResult = vi.fn();

      queueEquippedSave(CHILD_B, { hat: "hat_beret" });
      queueEquippedSave(CHILD_B, { hat: "hat_none", glasses: "glasses_round" });
      queueEquippedSave(CHILD_B, outfit, onResult);
      await vi.advanceTimersByTimeAsync(399);
      expect(fetchMock).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2);

      await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: "saved" })));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sentBody(0)).toEqual({ equipped: { ...outfit, glasses: "glasses_round" } });
    });

    it("writes the change down at once, before anything is sent (so closing right away loses nothing)", () => {
      vi.useFakeTimers();
      queueEquippedSave(CHILD_B, outfit);
      expect(pendingOf(CHILD_B)).toEqual(outfit);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends right away on flush (closing the dress-up), then has nothing left to send", async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(respond(full));
      queueEquippedSave(CHILD_B, outfit);
      await flushEquippedSave();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("sends a change to the child it was made for, even when a sibling is opened before the timer fires", async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(respond(full));
      queueEquippedSave(CHILD_B, outfit);

      fetchMock.mockResolvedValueOnce(ok(serverData(0))); // きょうだい A を開いたときの読み込み
      await syncRewardsFromServer(CHILD_A);
      await vi.advanceTimersByTimeAsync(500);

      const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
      expect(puts).toHaveLength(1);
      expect(String(puts[0][0])).toBe(`/api/children/${CHILD_B}/rewards`);
      expect(JSON.parse(String(puts[0][1].body))).toEqual({ equipped: outfit });
    });

    it("keeps a queued save for its own child when a different child's change is queued after it", async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(respond(full));
      queueEquippedSave(CHILD_B, { hat: "hat_safari" });
      queueEquippedSave(CHILD_A, { glasses: "glasses_round" });
      await vi.advanceTimersByTimeAsync(500);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

      const sent = fetchMock.mock.calls.map(([url, init]) => [String(url), JSON.parse(String(init.body)).equipped]);
      expect(sent).toContainEqual([`/api/children/${CHILD_B}/rewards`, { hat: "hat_safari" }]);
      expect(sent).toContainEqual([`/api/children/${CHILD_A}/rewards`, { glasses: "glasses_round" }]);
    });

    it("never has two saves in flight, and a save made while one is in flight goes to its own child", async () => {
      vi.useFakeTimers();
      let release: (response: Response) => void = () => undefined;
      fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)));
      fetchMock.mockResolvedValue(respond(full));
      const putsSoFar = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");

      queueEquippedSave(CHILD_B, { hat: "hat_beret" });
      const first = flushEquippedSave();
      await vi.advanceTimersByTimeAsync(0); // 1つめを送り出させる(送信中にする)
      expect(putsSoFar()).toHaveLength(1);

      queueEquippedSave(CHILD_B, outfit); // 送信中に 変えた
      const second = flushEquippedSave();
      // 送っている途中に きょうだいを開いても、2つめは B のまま
      fetchMock.mockResolvedValueOnce(ok(serverData(0)));
      const syncing = syncRewardsFromServer(CHILD_A);
      await vi.advanceTimersByTimeAsync(50);
      expect(putsSoFar()).toHaveLength(1); // 1つずつ。2つめは 1つめが返るまで送らない

      release(respond({ ...DEFAULT_EQUIPPED, hat: "hat_beret" }));
      await Promise.all([first, second, syncing]);
      const puts = putsSoFar();
      expect(puts).toHaveLength(2);
      expect(JSON.parse(String(puts[0][1].body))).toEqual({ equipped: { hat: "hat_beret" } });
      expect(String(puts[1][0])).toBe(`/api/children/${CHILD_B}/rewards`);
      expect(JSON.parse(String(puts[1][1].body))).toEqual({ equipped: outfit });
    });

    it("folds a change made right after a flush into that same request (it reads what is waiting when it sends)", async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(respond(full));
      queueEquippedSave(CHILD_B, { hat: "hat_beret" });
      const first = flushEquippedSave();
      queueEquippedSave(CHILD_B, outfit);
      const second = flushEquippedSave();
      await Promise.all([first, second]);

      const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
      expect(puts).toHaveLength(1);
      expect(JSON.parse(String(puts[0][1].body))).toEqual({ equipped: outfit });
    });

    it("keeps the change when the request fails, and sends it again with the next change", async () => {
      fetchMock.mockRejectedValueOnce(new Error("offline"));
      expect((await saveEquippedToServer(CHILD_B, { hat: "hat_safari" })).status).toBe("failed");
      expect(pendingOf(CHILD_B)).toEqual({ hat: "hat_safari" });

      fetchMock.mockResolvedValueOnce(respond(full));
      expect((await saveEquippedToServer(CHILD_B, { glasses: "glasses_round" })).status).toBe("saved");
      expect(sentBody(1)).toEqual({ equipped: { hat: "hat_safari", glasses: "glasses_round" } });
      expect(pendingOf(CHILD_B)).toEqual({});
    });

    it("also keeps the change for a busy or failing server (5xx, 429), not for a refusal", async () => {
      for (const code of [500, 503, 429]) {
        fetchMock.mockResolvedValueOnce(status(code));
        expect((await saveEquippedToServer(CHILD_B, { hat: "hat_safari" })).status, String(code)).toBe("failed");
        expect(pendingOf(CHILD_B), String(code)).toEqual({ hat: "hat_safari" });
        localStorage.removeItem(`kanoha_equipped_pending_v1:${CHILD_B}`);
      }
    });

    it("does not keep what the server refuses (not logged in, someone else's child), and does not call it a failure", async () => {
      for (const code of [400, 401, 403, 404]) {
        fetchMock.mockResolvedValueOnce(status(code));
        const result = await saveEquippedToServer(CHILD_B, { hat: "hat_safari" });
        expect(result.status, String(code)).toBe("local");
        expect(pendingOf(CHILD_B), String(code)).toEqual({});
      }
    });

    it("keeps a change made while the request was in flight", async () => {
      let release: (response: Response) => void = () => undefined;
      fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)));
      fetchMock.mockResolvedValue(respond(full));
      const saving = saveEquippedToServer(CHILD_B, { hat: "hat_safari" });

      queueEquippedSave(CHILD_B, { glasses: "glasses_round" }); // 送っている間に 別の枠を変えた
      release(respond({ ...DEFAULT_EQUIPPED, hat: "hat_safari" }));
      await saving;

      expect(pendingOf(CHILD_B)).toEqual({ glasses: "glasses_round" });
      await flushEquippedSave();
    });

    it("shows a change that could not be sent on top of the server's state when the child is opened, and sends only that", async () => {
      fetchMock.mockRejectedValueOnce(new Error("offline"));
      await saveEquippedToServer(CHILD_B, outfit);

      // 開き直し: サーバーの古い着せかえで上書きせず、重ねて見せて、その分だけ送り直す
      fetchMock
        .mockResolvedValueOnce(ok({ ...serverData(0), equipped: { ...DEFAULT_EQUIPPED, glasses: "glasses_round" } }))
        .mockResolvedValueOnce(respond({ ...full, glasses: "glasses_round" }));
      await syncRewardsFromServer(CHILD_B);

      expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "PUT" });
      expect(sentBody(2)).toEqual({ equipped: outfit });
      expect(getEquippedAccessories()).toMatchObject({ hat: "hat_safari", effect: "effect_sparkle", glasses: "glasses_round" });
      expect(pendingOf(CHILD_B)).toEqual({});

      // 送り直せたので、次からは普通にサーバーの値に合わせる
      fetchMock.mockResolvedValueOnce(ok({ ...serverData(0), equipped: { ...DEFAULT_EQUIPPED, hat: "hat_beret" } }));
      await syncRewardsFromServer(CHILD_B);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(getEquippedAccessories().hat).toBe("hat_beret");
    });

    it("sends what is still waiting before it reads, so the read cannot bring back an older state", async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValueOnce(respond(full));
      queueEquippedSave(CHILD_B, outfit);

      fetchMock.mockResolvedValueOnce(ok({ ...serverData(0), equipped: full }));
      await syncRewardsFromServer(CHILD_B);

      const order = fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET");
      expect(order.slice(0, 2)).toEqual(["PUT", "GET"]);
      expect(getEquippedAccessories()).toMatchObject(outfit);
    });

    it("keeps a change made while the child was loading", async () => {
      let releaseGet: (response: Response) => void = () => undefined;
      fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseGet = resolve)));
      fetchMock.mockResolvedValue(respond(full));
      const loading = syncRewardsFromServer(CHILD_B);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // 読み込みが 飛んでいる

      queueEquippedSave(CHILD_B, outfit); // 読み込み中に 着せかえた
      releaseGet(ok({ ...serverData(0), equipped: DEFAULT_EQUIPPED }));
      await loading;

      expect(getEquippedAccessories()).toMatchObject(outfit); // サーバーの古い値で 戻されない
      await flushEquippedSave();
    });

    it("never sends or keeps anything for an id that is not a child's (the demo has the id \"demo\")", async () => {
      expect((await saveEquippedToServer("demo", outfit)).status).toBe("local");
      queueEquippedSave("demo", outfit);
      await flushEquippedSave();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(localStorage.getItem("kanoha_equipped_pending_v1:demo")).toBeNull();
    });

    it("does not touch this device's display for a refused slot when another child is the one open", async () => {
      saveEquippedAccessories(full);
      localStorage.setItem("kanoha_active_child_v1", CHILD_A); // 表示しているのは A。いま保存したのは B
      fetchMock.mockResolvedValueOnce(respond({ ...full, effect: "effect_none" }, ["effect"]));
      await saveEquippedToServer(CHILD_B, outfit);
      expect(getEquippedAccessories().effect).toBe("effect_sparkle");
    });

    it("does not put back a slot that was chosen again while the request was in flight", async () => {
      let release: (response: Response) => void = () => undefined;
      fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)));
      fetchMock.mockResolvedValue(respond(full));
      saveEquippedAccessories({ ...DEFAULT_EQUIPPED, hat: "hat_beret" });
      const saving = saveEquippedToServer(CHILD_B, { hat: "hat_crown" });

      queueEquippedSave(CHILD_B, { hat: "hat_beret" }); // 送っている間に 選びなおした
      release(respond({ ...DEFAULT_EQUIPPED, hat: "hat_none" }, ["hat"]));
      await saving;

      expect(getEquippedAccessories().hat).toBe("hat_beret");
      await flushEquippedSave();
    });

    it("never sends one child's unsaved dress-up to a sibling", async () => {
      fetchMock.mockRejectedValueOnce(new Error("offline"));
      await saveEquippedToServer(CHILD_B, outfit);

      fetchMock.mockResolvedValueOnce(ok({ ...serverData(0), equipped: DEFAULT_EQUIPPED }));
      await syncRewardsFromServer(CHILD_A);

      expect(fetchMock).toHaveBeenCalledTimes(2); // 失敗した PUT と、A を開いたときの GET だけ
      expect(getEquippedAccessories().hat).toBe("hat_none");
      expect(pendingOf(CHILD_B)).toEqual(outfit); // B の分は B のために残る
    });

    it("does not let a slow load of one child overwrite the display of the child opened after it", async () => {
      let releaseA: (response: Response) => void = () => undefined;
      fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseA = resolve)));
      const loadingA = syncRewardsFromServer(CHILD_A);

      fetchMock.mockResolvedValueOnce(ok({ ...serverData(0), equipped: { ...DEFAULT_EQUIPPED, hat: "hat_beret" } }));
      await syncRewardsFromServer(CHILD_B);
      expect(getEquippedAccessories().hat).toBe("hat_beret");

      releaseA(ok({ ...serverData(0), equipped: { ...DEFAULT_EQUIPPED, hat: "hat_safari" } }));
      expect(await loadingA).toBe(false);
      expect(getEquippedAccessories().hat).toBe("hat_beret"); // 遅れて届いた A の値では 上書きしない
    });
  });

  it("applies the server-recorded reward and fires the five-yen event", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    const result = applyServerReward({ currentCycleCount: 0, totalCorrectCount: 10, totalRewardYen: 5 });
    expect(result).toMatchObject({ earnedFiveYen: true, leveledUp: false, newCycleCount: 10 });
    expect(getRewardState().totalRewardYen).toBe(5);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "kanoha-five-yen-earned" }));
    expect(applyServerReward(null)).toBeNull();
    spy.mockRestore();
  });
});
