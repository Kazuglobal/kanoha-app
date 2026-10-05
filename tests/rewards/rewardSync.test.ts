import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEquippedAccessories, saveEquippedAccessories } from "@/lib/rewards/characterGrowthStore";
import { getActiveChildId, saveEquipToServer, syncRewardsFromServer } from "@/lib/rewards/rewardSync";
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

  it("saves accessories for the active child only", async () => {
    expect(await saveEquipToServer("hat", "hat_safari")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(ok(serverData(0)));
    await syncRewardsFromServer(CHILD_B);
    saveEquippedAccessories(getEquippedAccessories());
    fetchMock.mockResolvedValueOnce(ok(serverData(0)));
    expect(await saveEquipToServer("hat", "hat_safari")).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/children/${CHILD_B}/rewards`);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PATCH" });
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
