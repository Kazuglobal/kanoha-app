"use client";

export interface SceneProgress {
  readonly stars: 1 | 2 | 3;
  readonly completedCount: number;
  readonly updatedAt: string;
}

export type EnglishTalkProgressMap = Readonly<Record<string, SceneProgress>>;

const STORAGE_PREFIX = "kanoha_english_talk_progress_v1";

function storageKey(childId?: string): string {
  return childId ? `${STORAGE_PREFIX}:${childId}` : STORAGE_PREFIX;
}

export function getEnglishTalkProgress(childId?: string): EnglishTalkProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(childId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const result: Record<string, SceneProgress> = {};
    for (const [sceneId, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const stars = e.stars === 3 ? 3 : e.stars === 2 ? 2 : e.stars === 1 ? 1 : null;
      if (!stars) continue;
      const completedCount =
        typeof e.completedCount === "number" && Number.isFinite(e.completedCount) && e.completedCount > 0
          ? Math.floor(e.completedCount)
          : 1;
      result[sceneId] = {
        stars,
        completedCount,
        updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date().toISOString(),
      };
    }
    return result;
  } catch {
    return {};
  }
}

export function recordEnglishTalkSceneClear(
  sceneId: string,
  stars: 1 | 2 | 3,
  childId?: string,
): SceneProgress {
  const current = getEnglishTalkProgress(childId);
  const prev = current[sceneId];
  const bestStars = (prev ? Math.max(prev.stars, stars) : stars) as 1 | 2 | 3;
  const nextEntry: SceneProgress = {
    stars: bestStars,
    completedCount: (prev?.completedCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  const updated: EnglishTalkProgressMap = {
    ...current,
    [sceneId]: nextEntry,
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(storageKey(childId), JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent("kanoha-english-talk-progress", { detail: updated }));
  }
  return nextEntry;
}
