import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { TalkSettings } from "@/lib/englishTalk/talkSettings";

/** 所有確認ずみの子どもの、親の設定(音・声のこたえ)。設定の行がまだなければ、どちらもオン。 */
export async function loadTalkSettings(childId: string): Promise<Required<TalkSettings>> {
  const row = await getDb()
    .select({ enableAudio: schema.appSettings.enableAudio, enableVoiceAnswer: schema.appSettings.enableVoiceAnswer })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.childId, childId))
    .get();
  return {
    enableAudio: row ? Boolean(row.enableAudio) : true,
    enableVoiceAnswer: row ? Boolean(row.enableVoiceAnswer) : true,
  };
}
