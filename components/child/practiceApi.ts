import type { Subject } from "@/lib/curriculum/subjects";
import { postJson } from "./learningApi";

/** 「あたらしい もんだい」の 1 問。ホームのカードに要る分だけ(問題文・選択肢・聞く英語は 問題を開いたときに受け取る)。 */
export interface PracticeItem {
  problemId: string;
  position: number;
  done: boolean;
}

export interface PracticeSet {
  batchId: string;
  seq: number;
  remainingSets: number;
  items: readonly PracticeItem[];
}

export type PracticeSetResult =
  | { kind: "ready"; set: PracticeSet }
  /** 今日の分は ぜんぶ作った */
  | { kind: "limit" }
  /** 出せる問題がない */
  | { kind: "empty" }
  /** 使えない(機能オフ・ログインしていない など)。カードを出さない */
  | { kind: "unavailable" }
  | { kind: "error" };

const isItem = (value: unknown): value is PracticeItem => {
  const item = value as Partial<PracticeItem> | null;
  return Boolean(item) && typeof item?.problemId === "string" && typeof item.position === "number" && typeof item.done === "boolean";
};

const isSet = (value: unknown): value is PracticeSet => {
  const set = value as Partial<PracticeSet> | null;
  return Boolean(set) && typeof set?.batchId === "string" && typeof set.remainingSets === "number" && Array.isArray(set.items) && set.items.every(isItem);
};

/** 今日の「あたらしい もんだい」を取る(more=true で次のセットを作る)。失敗は kind で返す。 */
export async function fetchPracticeSet(childId: string, subject: Subject, more = false): Promise<PracticeSetResult> {
  const response = await postJson("/api/practice/new-set", { childId, subject, more }).catch(() => null);
  if (!response) return { kind: "error" };
  if ([401, 403, 404].includes(response.status)) return { kind: "unavailable" };
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success || !body.data) return { kind: "error" };
  if (body.data.status === "limit") return { kind: "limit" };
  if (body.data.status === "empty") return { kind: "empty" };
  return body.data.status === "ready" && isSet(body.data) ? { kind: "ready", set: body.data } : { kind: "error" };
}
