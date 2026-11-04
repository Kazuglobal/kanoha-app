import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { loadTalkSettings } from "@/app/child/english-talk/talkSettings";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-talk-settings-1";
const CHILD = "dddddddd-4444-4444-8444-dddddddddddd";

describe("loadTalkSettings", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();
    await db.delete(schema.appSettings).where(eq(schema.appSettings.childId, CHILD)).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();
    await db
      .insert(schema.users)
      .values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run();
    await db
      .insert(schema.childProfiles)
      .values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now })
      .run();
  });

  const saveSettings = (values: { enableAudio: number; enableVoiceAnswer: number }) =>
    db
      .insert(schema.appSettings)
      .values({ id: crypto.randomUUID(), childId: CHILD, ...values, createdAt: nowJstIso(), updatedAt: nowJstIso() })
      .run();

  it("親の設定の行がまだなければ、音も声のこたえもオン", async () => {
    expect(await loadTalkSettings(CHILD)).toEqual({ enableAudio: true, enableVoiceAnswer: true });
  });

  it("親の設定どおりに返す(音をオフ・声のこたえをオフ)", async () => {
    await saveSettings({ enableAudio: 0, enableVoiceAnswer: 1 });
    expect(await loadTalkSettings(CHILD)).toEqual({ enableAudio: false, enableVoiceAnswer: true });
    await db.delete(schema.appSettings).where(eq(schema.appSettings.childId, CHILD)).run();
    await saveSettings({ enableAudio: 1, enableVoiceAnswer: 0 });
    expect(await loadTalkSettings(CHILD)).toEqual({ enableAudio: true, enableVoiceAnswer: false });
  });
});
