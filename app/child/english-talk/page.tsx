import Link from "next/link";
import { ChildHeader } from "@/components/child/ChildHeader";
import { SceneProgressBadge } from "@/components/child/englishTalk/SceneProgressBadge";
import { getSceneFriendName } from "@/components/child/englishTalk/ThreeTalkStage3D";
import styles from "@/components/kanoha.module.css";
import talkStyles from "@/components/child/englishTalk/englishTalk.module.css";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { resolveOwnedChildId } from "./ownedChild";

/** えいごで おはなし: シーンをえらぶ画面。 */
export default async function EnglishTalkListPage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const childId = await resolveOwnedChildId((await searchParams).childId);
  const query = childId ? `?childId=${childId}` : "";

  return (
    <div className={`${styles.childShell} ${styles.appScreen}`}>
      <ChildHeader childId={childId} />
      <header className={talkStyles.listHeader}>
        <h1>えいごで おはなし</h1>
        <p>かのはちゃんと おともだちと いっしょに、いろいろな ばしょで えいごを はなしてみよう！</p>
      </header>
      <main className={talkStyles.sceneList}>
        {TALK_SCENES.map((scene) => {
          const friendName = getSceneFriendName(scene.id);
          return (
            <Link key={scene.id} href={`/child/english-talk/${scene.id}${query}`} className={talkStyles.sceneCard}>
              <span
                className={talkStyles.sceneThumb}
                style={{ backgroundImage: `url(${scene.background})` }}
                aria-hidden="true"
              >
                <SceneProgressBadge sceneId={scene.id} childId={childId} />
              </span>
              <span className={talkStyles.sceneCardBody}>
                <strong>
                  <span aria-hidden="true">{scene.emoji}</span> {scene.title}
                </strong>
                <small lang="en">{scene.titleEn}</small>
                <small>{scene.description}</small>
                <span className={talkStyles.sceneFriendTag}>🤝 おともだち: {friendName}</span>
              </span>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
