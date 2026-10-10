"use client";

import { spendRewardYen, refundRewardYen } from "./rewardStore";

export type RealRewardCategory = "sticker" | "snack" | "toy" | "special";

export interface RealRewardItem {
  id: string;
  title: string;
  category: RealRewardCategory;
  icon: string;
  costYen: number;
  description: string;
  enabled: boolean;
}

export interface RewardClaimTicket {
  id: string;
  itemId: string;
  itemTitle: string;
  itemIcon: string;
  costYen: number;
  claimedAt: string;
  status: "pending" | "fulfilled";
  fulfilledAt?: string;
}

const ITEMS_STORAGE_KEY = "kanoha_real_reward_items_v1";
const TICKETS_STORAGE_KEY = "kanoha_reward_tickets_v1";

export const DEFAULT_REAL_REWARD_ITEMS: readonly RealRewardItem[] = [
  {
    id: "reward_sticker_pack",
    title: "きらきらシール 1まい",
    category: "sticker",
    icon: "🌟",
    costYen: 30,
    description: "すきなシールを 1まい えらんでもらえるよ！",
    enabled: true,
  },
  {
    id: "reward_snack_treat",
    title: "すきなお菓子 1こ",
    category: "snack",
    icon: "🍫",
    costYen: 50,
    description: "おやつタイムに だいすきなお菓子を ゲット！",
    enabled: true,
  },
  {
    id: "reward_ice_cream",
    title: "とくべつな アイス・プリン",
    category: "snack",
    icon: "🍦",
    costYen: 100,
    description: "がんばった ごほうびに ひんやりスイーツ！",
    enabled: true,
  },
  {
    id: "reward_game_time",
    title: "じゆうじかん 15ふん",
    category: "special",
    icon: "🎮",
    costYen: 30,
    description: "すきなあそびや YouTube を 15ふん プラス！",
    enabled: true,
  },
  {
    id: "reward_capsule_toy",
    title: "すきなガチャ・おもちゃ",
    category: "toy",
    icon: "🎁",
    costYen: 200,
    description: "たくさんためた えらいキミに！ おでかけのときに まわそう！",
    enabled: true,
  },
];

export function getRealRewardItems(): RealRewardItem[] {
  if (typeof window === "undefined") return [...DEFAULT_REAL_REWARD_ITEMS];
  try {
    const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_REAL_REWARD_ITEMS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return [...DEFAULT_REAL_REWARD_ITEMS];
}

export function saveRealRewardItems(items: RealRewardItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("kanoha-real-rewards-update", { detail: items }));
  } catch {
    // ignore
  }
}

export function getRewardClaimTickets(): RewardClaimTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return [];
}

function saveTickets(tickets: RewardClaimTicket[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
    window.dispatchEvent(new CustomEvent("kanoha-reward-tickets-update", { detail: tickets }));
  } catch {
    // ignore
  }
}

/**
 * 子どもがごほうびアイテムを申請・交換する
 */
export function claimRealReward(item: RealRewardItem): RewardClaimTicket | null {
  const success = spendRewardYen(item.costYen);
  if (!success) return null;

  const newTicket: RewardClaimTicket = {
    id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    itemId: item.id,
    itemTitle: item.title,
    itemIcon: item.icon,
    costYen: item.costYen,
    claimedAt: new Date().toISOString(),
    status: "pending",
  };

  const tickets = [newTicket, ...getRewardClaimTickets()];
  saveTickets(tickets);
  return newTicket;
}

/**
 * 保護者が「あげたよ！」ボタンを押してごほうびを渡したことにする
 */
export function fulfillTicket(ticketId: string): void {
  const tickets = getRewardClaimTickets().map((t) => {
    if (t.id === ticketId) {
      return {
        ...t,
        status: "fulfilled" as const,
        fulfilledAt: new Date().toISOString(),
      };
    }
    return t;
  });
  saveTickets(tickets);
}

/**
 * チケットのキャンセル（未渡しの場合、おこづかいを返金する）
 */
export function cancelTicket(ticketId: string): void {
  const tickets = getRewardClaimTickets();
  const target = tickets.find((t) => t.id === ticketId);
  if (!target) return;

  if (target.status === "pending") {
    refundRewardYen(target.costYen);
  }

  const updated = tickets.filter((t) => t.id !== ticketId);
  saveTickets(updated);
}
