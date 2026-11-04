"use client";

import type { AccessoryCategory, EquippedAccessories } from "./catalog";
import { normalizeEquipped, normalizeRewardState, type RewardState } from "./rewardLogic";
import { getRewardState, saveRewardState } from "./rewardStore";
import { getEquippedAccessories, saveEquippedAccessories } from "./characterGrowthStore";
import { SLOT_IDS } from "./slots";

/**
 * 端末キャッシュと DB(child_rewards)の同期。
 * - 子ども画面を開いたら、その子のごほうび・着せかえを DB から読んで表示を合わせる
 * - 以前の版で端末だけに貯まっていたごほうびは、最初の1回だけその子へ取り込む
 * - 着せかえは、変えた枠だけを、少し待ってまとめて(1回の PUT で)保存する。変えたらすぐ「保存待ち」として端末に書き、
 *   サーバーが受け取ったら消す(送る前・送っている途中に画面を閉じても、次にその子を開いたとき送り直せる)。
 *   保存待ちは子どもごと。送る先は、変えたときに画面が持っていた子どもで、共有の「開いている子」では決めない
 *   (きょうだいを切り替えたあと・別のタブで、前の子の分が別の子に書かれないように)
 */

const ACTIVE_CHILD_KEY = "kanoha_active_child_v1";
/** 旧データの取り込みは端末ごとに1回だけ(きょうだいに二重で入らないように) */
const LEGACY_IMPORTED_KEY = "kanoha_rewards_legacy_imported_v1";
/** 保存待ちの着せかえ(枠 → アイテム)。この名前のあとに子どもの ID を付けて、子どもごとに残す */
const PENDING_EQUIP_PREFIX = "kanoha_equipped_pending_v1:";
const SAVE_DELAY_MS = 400;
/** 送信が返らないまま止まったら、あきらめて「あとで送り直す」にする(鎖が止まり続けない) */
const REQUEST_TIMEOUT_MS = 15_000;
/** 子ども画面を開いたとき、前の保存が終わるのを待つ上限(遅い回線で表示が遅れすぎないように) */
const SYNC_WAIT_MS = 2_000;
const UUID = /^[0-9a-f-]{36}$/i;

/** 着せかえの「変えた枠だけ」(枠 → アイテム)。 */
export type EquipChanges = Partial<EquippedAccessories>;

interface ServerRewards {
  reward: RewardState;
  equipped: EquippedAccessories;
  stored: boolean;
  /** サーバーが着せなかった枠(まだ解放されていない・カタログに無い) */
  rejected: AccessoryCategory[];
}

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても続ける
  }
};

const removeStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // 消せなくても続ける
  }
};

const parseRejected = (value: unknown): AccessoryCategory[] =>
  Array.isArray(value)
    ? value.filter((slot): slot is AccessoryCategory => (SLOT_IDS as readonly unknown[]).includes(slot))
    : [];

const parseServerRewards = (data: unknown): ServerRewards | null => {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  return {
    reward: normalizeRewardState(value.reward as Partial<Record<keyof RewardState, unknown>>),
    equipped: normalizeEquipped(value.equipped),
    stored: value.stored === true,
    rejected: parseRejected(value.rejected),
  };
};

type RewardsResponse =
  | { kind: "ok"; data: ServerRewards }
  /** 通信できなかった・サーバーが混んでいる・一時的な失敗: あとでもう一度送れば通るかもしれない */
  | { kind: "retry" }
  /** 400 / 401 / 403 / 404 など: 送りなおしても通らない(ログアウトした・別の親の子・内容が不正) */
  | { kind: "refused" };

async function requestRewardsDetailed(childId: string, init?: RequestInit): Promise<RewardsResponse> {
  const response = await fetch(`/api/children/${childId}/rewards`, init).catch(() => null);
  if (!response || response.status >= 500 || response.status === 429 || response.status === 408) return { kind: "retry" };
  if (!response.ok) return { kind: "refused" };
  const json = await response.json().catch(() => null);
  const data = json?.success ? parseServerRewards(json.data) : null;
  return data ? { kind: "ok", data } : { kind: "retry" };
}

async function requestRewards(childId: string, init?: RequestInit): Promise<ServerRewards | null> {
  const result = await requestRewardsDetailed(childId, init);
  return result.kind === "ok" ? result.data : null;
}

const sendJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** この端末で最後に読み込んだ子ども。着せかえの保存先を決めるためには使わない(画面が持っている子どもを渡す)。 */
export function getActiveChildId(): string | null {
  const id = readStorage(ACTIVE_CHILD_KEY);
  return id && UUID.test(id) ? id : null;
}

async function importLegacyIfNeeded(childId: string, loaded: ServerRewards): Promise<ServerRewards> {
  if (readStorage(LEGACY_IMPORTED_KEY)) return loaded;
  const legacy = getRewardState();
  const hasLegacy = legacy.totalCorrectCount > 0;
  const imported =
    !loaded.stored && hasLegacy
      ? await requestRewards(childId, sendJson("POST", { reward: legacy, equipped: getEquippedAccessories() }))
      : loaded;
  if (!imported) return loaded; // 失敗したら次に開いたときにもう一度
  writeStorage(LEGACY_IMPORTED_KEY, new Date().toISOString());
  return imported;
}

const pendingKey = (childId: string) => `${PENDING_EQUIP_PREFIX}${childId}`;

/** 知っている枠の、文字列のアイテムだけを残す(壊れた値・知らない枠は捨てる)。 */
const parseChanges = (raw: unknown): EquipChanges =>
  raw && typeof raw === "object"
    ? Object.fromEntries(
        Object.entries(raw).filter(([slot, itemId]) => (SLOT_IDS as readonly string[]).includes(slot) && typeof itemId === "string"),
      )
    : {};

/** この子の保存待ちの着せかえ(無ければ空)。 */
function readPendingEquip(childId: string): EquipChanges {
  try {
    return parseChanges(JSON.parse(readStorage(pendingKey(childId)) ?? "null"));
  } catch {
    return {};
  }
}

function writePendingEquip(childId: string, changes: EquipChanges): void {
  if (Object.keys(changes).length === 0) removeStorage(pendingKey(childId));
  else writeStorage(pendingKey(childId), JSON.stringify(changes));
}

/** 送り終えた分を保存待ちから消す。送っている間に変えた枠(値がちがうもの)は残す。 */
function settlePending(childId: string, sent: EquipChanges): void {
  const stillPending = Object.fromEntries(
    Object.entries(readPendingEquip(childId)).filter(([slot, itemId]) => sent[slot as keyof EquipChanges] !== itemId),
  );
  writePendingEquip(childId, stillPending);
}

export type EquippedSaveStatus = "saved" | "local" | "failed";
export interface EquippedSaveResult {
  /**
   * saved=保存できた / local=サーバーには送らなかった・受け付けられなかった(デモ・ログアウト後・別の親の子)ので端末だけ /
   * failed=通信などで保存できなかった(保存待ちに残してあり、後で送り直す)
   */
  status: EquippedSaveStatus;
  rejected: AccessoryCategory[];
}

/** サーバーが着せなかった枠だけ、端末の着せかえもサーバーの値に戻す(ほかの枠は今の表示のまま。その子を開いているときだけ)。 */
function revertRejectedSlots(childId: string, saved: ServerRewards): void {
  if (saved.rejected.length === 0 || getActiveChildId() !== childId) return;
  // 送っている間に選びなおした枠(まだ保存待ちに残っている)は、新しい選びのまま戻さない
  const stillPending = readPendingEquip(childId);
  const slots = saved.rejected.filter((slot) => !(slot in stillPending));
  if (slots.length === 0) return;
  saveEquippedAccessories({ ...getEquippedAccessories(), ...Object.fromEntries(slots.map((slot) => [slot, saved.equipped[slot]])) });
}

/**
 * 着せかえの保存待ち(と、いま渡した変更)を、その子どもへ 1 回の PUT で送る。子どもが決まっていなければ(デモ)送らない。
 * 送った分は、サーバーが受け取ったとき(受け付けられないと分かったときも)保存待ちから消す。
 */
export async function saveEquippedToServer(childId: string | null, changes: EquipChanges = {}): Promise<EquippedSaveResult> {
  if (!childId || !UUID.test(childId)) return { status: "local", rejected: [] };
  if (Object.keys(changes).length > 0) writePendingEquip(childId, { ...readPendingEquip(childId), ...changes });
  const sent = readPendingEquip(childId);
  if (Object.keys(sent).length === 0) return { status: "saved", rejected: [] };

  // keepalive: 画面を閉じる・離れる直前に送っても途中で切れない
  const result = await requestRewardsDetailed(childId, {
    ...sendJson("PUT", { equipped: sent }),
    keepalive: true,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (result.kind === "retry") return { status: "failed", rejected: [] };
  // 受け付けられないもの(ログアウトした・別の親の子)は残さない。あとで別のアカウントの記録に書かないように
  settlePending(childId, sent);
  if (result.kind === "refused") return { status: "local", rejected: [] };
  revertRejectedSlots(childId, result.data);
  return { status: "saved", rejected: result.data.rejected };
}

interface QueuedSave {
  /** 変えた時点で画面が持っていた子ども。送る瞬間には決めない */
  childId: string;
  onResult?: (result: EquippedSaveResult) => void;
}

let queued: QueuedSave | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** 保存は1つずつ。古い保存があとから届いて新しい着せかえを上書きしないようにつなぐ */
let lastSave: Promise<EquippedSaveResult | void> = Promise.resolve();
let leaveFlushInstalled = false;

/** その子の保存待ちを、前の保存のあとに送る(送る分は、送る瞬間の保存待ち)。 */
function chainSave(childId: string, onResult?: (result: EquippedSaveResult) => void): void {
  lastSave = lastSave
    .catch(() => undefined)
    .then(() => saveEquippedToServer(childId))
    .then((result) => {
      onResult?.(result);
      return result;
    });
}

/** いま待っている着せかえをすぐ送る。送るものが無ければ、送信中の保存が終わるのを待つ(失敗は保存待ちに残してあるので、ここでは投げない)。 */
export async function flushEquippedSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const job = queued;
  queued = null;
  if (job) chainSave(job.childId, job.onResult);
  await lastSave.catch(() => undefined);
}

function flushWhenLeaving(): void {
  if (leaveFlushInstalled || typeof window === "undefined") return;
  leaveFlushInstalled = true;
  window.addEventListener("pagehide", () => void flushEquippedSave());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushEquippedSave();
  });
}

/**
 * 着せかえの保存を予約する。変えた枠はすぐ保存待ち(端末)に書き、少し待ってまとめて1回だけ送る
 * (キャラ替えで何本も同時に走らない)。childId が無いとき(デモ)は何もしない。
 * onResult には、この変更を送った結果が届く。
 */
export function queueEquippedSave(
  childId: string | null,
  changes: EquipChanges,
  onResult?: (result: EquippedSaveResult) => void,
): void {
  if (!childId || !UUID.test(childId)) return;
  // 別の子の分が待っているときは、その子の分を先に送る(混ぜない)
  if (queued && queued.childId !== childId) void flushEquippedSave();
  writePendingEquip(childId, { ...readPendingEquip(childId), ...changes });
  queued = { childId, onResult: onResult ?? (queued?.childId === childId ? queued.onResult : undefined) };
  flushWhenLeaving();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushEquippedSave(), SAVE_DELAY_MS);
}

/** promise を、最大 ms ミリ秒だけ待つ(間に合わなくても止めずに先へ進む。待っていた処理はそのまま続く)。 */
async function withDeadline(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([promise, new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)))]);
  if (timer) clearTimeout(timer);
}

/** 子ども画面を開いたときに呼ぶ。失敗したら端末の表示のまま続ける。 */
export async function syncRewardsFromServer(childId: string): Promise<boolean> {
  if (!UUID.test(childId)) return false;
  // 開いている子ども(読み込みに失敗しても、ほかの子の表示を取りちがえないように先に切り替える)
  writeStorage(ACTIVE_CHILD_KEY, childId);
  // この端末で まだ送っていない着せかえを先に送る(読み込みが追いこして、古い値が返ってくるのを防ぐ)
  await withDeadline(flushEquippedSave(), SYNC_WAIT_MS);
  const loaded = await requestRewards(childId);
  if (!loaded) return false;
  const current = await importLegacyIfNeeded(childId, loaded);
  // 読み込んでいるあいだに別の子へ切り替わっていたら、その子の表示を上書きしない
  if (getActiveChildId() !== childId) return false;
  saveRewardState(current.reward);
  // 送れていない選びは、サーバーの値に重ねて見せて、その分だけを送り直す(読み込み中に変えた分も、ここに入っている)
  const pending = readPendingEquip(childId);
  saveEquippedAccessories({ ...current.equipped, ...pending });
  if (Object.keys(pending).length > 0) {
    chainSave(childId);
    await lastSave.catch(() => undefined);
  }
  return true;
}
