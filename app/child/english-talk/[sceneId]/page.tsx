import { notFound } from "next/navigation";
import { ChildHeader } from "@/components/child/ChildHeader";
import { EnglishTalkStage } from "@/components/child/englishTalk/EnglishTalkStage";
import styles from "@/components/kanoha.module.css";
import { getTalkScene } from "@/lib/curriculum/englishTalkScenes";
import { toPublicScene } from "@/lib/englishTalk/judge";
import { resolveOwnedChildId } from "../ownedChild";

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

  return (
    <div className={`${styles.childShell} ${styles.appScreen}`}>
      <ChildHeader childId={childId} />
      <EnglishTalkStage scene={toPublicScene(scene)} childId={childId} />
    </div>
  );
}
