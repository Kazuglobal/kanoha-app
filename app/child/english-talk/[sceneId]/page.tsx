import { notFound } from "next/navigation";
import { ChildHeader } from "@/components/child/ChildHeader";
import { EnglishTalkStage } from "@/components/child/englishTalk/EnglishTalkStage";
import styles from "@/components/kanoha.module.css";
import { getTalkScene } from "@/lib/curriculum/englishTalkScenes";
import { toPublicScene } from "@/lib/englishTalk/judge";
import { resolveOwnedChildId } from "../ownedChild";
import { loadTalkSettings } from "../talkSettings";

/** えいごで おはなし: シーンの中で かのはちゃんと会話する。判定キーはクライアントへ渡さない。 */
export default async function EnglishTalkScenePage({
  params,
  searchParams,
}: {
  params: Promise<{ sceneId: string }>;
  searchParams: Promise<{ childId?: string }>;
}) {
  const [{ sceneId }, { childId: rawChildId }] = await Promise.all([params, searchParams]);
  const scene = getTalkScene(sceneId);
  if (!scene) notFound();
  const childId = await resolveOwnedChildId(rawChildId);
  // 親の設定(音・声のこたえ)は、所有確認できた子のぶんだけ読む。デモは両方オン。
  const settings = childId ? await loadTalkSettings(childId) : undefined;

  return (
    <div className={`${styles.childShell} ${styles.appScreen}`}>
      <ChildHeader childId={childId} />
      <EnglishTalkStage scene={toPublicScene(scene)} childId={childId} settings={settings} />
    </div>
  );
}
