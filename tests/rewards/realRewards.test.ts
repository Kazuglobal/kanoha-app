import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_REAL_REWARD_ITEMS,
  claimRealReward,
  fulfillTicket,
  cancelTicket,
  getRealRewardItems,
  getRewardClaimTickets,
  saveRealRewardItems,
} from "@/lib/rewards/realRewardStore";
import { getRewardState, saveRewardState } from "@/lib/rewards/rewardStore";

describe("Real Reward Exchange System", () => {
  beforeEach(() => {
    localStorage.clear();
    saveRewardState({
      currentCycleCount: 0,
      totalCorrectCount: 100,
      totalRewardYen: 100,
    });
  });

  it("loads default reward items initially", () => {
    const items = getRealRewardItems();
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.some((i) => i.id === "reward_sticker_pack")).toBe(true);
    expect(items.some((i) => i.id === "reward_snack_treat")).toBe(true);
  });

  it("claims a reward item, deducts money, and issues a pending ticket", () => {
    const item = getRealRewardItems().find((i) => i.id === "reward_sticker_pack")!;
    expect(item.costYen).toBe(30);

    const ticket = claimRealReward(item);
    expect(ticket).not.toBeNull();
    expect(ticket?.status).toBe("pending");
    expect(ticket?.itemTitle).toBe(item.title);
    expect(ticket?.costYen).toBe(30);

    // 100円 - 30円 = 70円
    expect(getRewardState().totalRewardYen).toBe(70);

    const tickets = getRewardClaimTickets();
    expect(tickets.length).toBe(1);
    expect(tickets[0].id).toBe(ticket?.id);
  });

  it("fails to claim when balance is insufficient", () => {
    saveRewardState({
      currentCycleCount: 0,
      totalCorrectCount: 10,
      totalRewardYen: 10,
    });

    const expensiveItem = getRealRewardItems().find((i) => i.id === "reward_capsule_toy")!;
    expect(expensiveItem.costYen).toBe(200);

    const ticket = claimRealReward(expensiveItem);
    expect(ticket).toBeNull();
    expect(getRewardState().totalRewardYen).toBe(10);
    expect(getRewardClaimTickets().length).toBe(0);
  });

  it("fulfills a ticket when parent marks it as given", () => {
    const item = getRealRewardItems()[0];
    const ticket = claimRealReward(item)!;
    expect(ticket.status).toBe("pending");

    fulfillTicket(ticket.id);

    const tickets = getRewardClaimTickets();
    expect(tickets[0].status).toBe("fulfilled");
    expect(tickets[0].fulfilledAt).toBeDefined();
  });

  it("cancels a pending ticket and refunds the money", () => {
    const item = getRealRewardItems()[0];
    const ticket = claimRealReward(item)!;
    const balanceAfterClaim = getRewardState().totalRewardYen;

    cancelTicket(ticket.id);

    // 返金されていること
    expect(getRewardState().totalRewardYen).toBe(balanceAfterClaim + item.costYen);
    expect(getRewardClaimTickets().length).toBe(0);
  });

  it("allows parent to save custom reward items", () => {
    const custom = [
      ...DEFAULT_REAL_REWARD_ITEMS,
      {
        id: "custom_manga",
        title: "すきなマンガ 1さつ",
        category: "special" as const,
        icon: "📖",
        costYen: 150,
        description: "本屋さんでえらぼう！",
        enabled: true,
      },
    ];

    saveRealRewardItems(custom);
    const loaded = getRealRewardItems();
    expect(loaded.length).toBe(DEFAULT_REAL_REWARD_ITEMS.length + 1);
    expect(loaded.some((i) => i.id === "custom_manga")).toBe(true);
  });
});
