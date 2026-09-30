import { BookOpen, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { CharacterCoach } from "@/components/child/CharacterCoach";
import { ChildHeader } from "@/components/child/ChildHeader";
import { RubyAuto } from "@/components/child/RubyText";
import { HOME_TEXT } from "@/components/child/childStrings";
import styles from "@/components/kanoha.module.css";
import { getTodayRecommendations } from "@/lib/review/today";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

type ReadingMode = "kanji_with_ruby" | "hiragana";

interface ChildProfile {
  id: string;
  nickname: string;
  reading_mode?: string | null;
}

interface RecommendedProblem {
  id: string;
  problem_text: string;
  unit: string;
  estimatedMinutes: number;
}

export default async function ChildHomePage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const session = await getServerSession();
  if (!session?.user) return <DemoHome />;

  const { childId } = await searchParams;
  const db = getDb();

  const profiles = await db
    .select({
      id: schema.childProfiles.id,
      nickname: schema.childProfiles.nickname,
      reading_mode: schema.childProfiles.readingMode,
    })
    .from(schema.childProfiles)
    .where(eq(schema.childProfiles.userId, session.user.id))
    .orderBy(schema.childProfiles.createdAt)
    .all();

  const children = (profiles ?? []) as ChildProfile[];
  const selected = children.find(({ id }) => id === childId) ?? children[0];
  if (!selected) return <NoProfileHome />;

  const readingMode: ReadingMode =
    selected.reading_mode === "hiragana" ? "hiragana" : "kanji_with_ruby";
  const [recommendation, recentProblemId] = await Promise.all([
    getTodayRecommendations(selected.id),
    loadRecentProblemId(selected.id, db),
  ]);

  return (
    <RealHome
      profiles={children}
      problems={recommendation.error ? [] : recommendation.problems}
      readingMode={readingMode}
      recentProblemId={recentProblemId}
      selected={selected}
    />
  );
}

/** 「もういちど」タイル用: いちばん最近といた問題の id(attempts から)。 */
async function loadRecentProblemId(childId: string, db = getDb()): Promise<string | null> {
  const row = await db
    .select({ problemId: schema.attempts.problemId })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.childId, childId), isNotNull(schema.attempts.problemId)))
    .orderBy(desc(schema.attempts.createdAt))
    .limit(1)
    .get();

  return row?.problemId ?? null;
}

function NoProfileHome() {
  return (
    <div className={styles.childShell}>
      <ChildHeader />
      <main className={styles.narrow}>
        <section className={`${styles.card} ${styles.resultHero}`}>
          <h1 className={styles.pageTitle}>{HOME_TEXT.makeProfileTitle}</h1>
          <p className={styles.lead}>
            <RubyAuto text={HOME_TEXT.makeProfileLead} readingMode="kanji_with_ruby" />
          </p>
        </section>
      </main>
    </div>
  );
}

function RealHome({
  profiles,
  problems,
  readingMode,
  recentProblemId,
  selected,
}: {
  profiles: ChildProfile[];
  problems: RecommendedProblem[];
  readingMode: ReadingMode;
  recentProblemId: string | null;
  selected: ChildProfile;
}) {
  const first = problems[0];
  const startHref = first
    ? (`/child/problem/${first.id}?childId=${selected.id}` as const)
    : (`/child/home?childId=${selected.id}` as const);
  const againHref = recentProblemId
    ? (`/child/problem/${recentProblemId}?childId=${selected.id}` as const)
    : startHref;

  return (
    <div className={styles.childShell}>
      <ChildHeader />
      <main className={styles.main}>
        <section className={styles.profileTabs}>
          {profiles.map((profile) => (
            <Link
              key={profile.id}
              href={`/child/home?childId=${profile.id}`}
              className={profile.id === selected.id ? styles.profileTabActive : styles.profileTab}
            >
              {profile.nickname}
            </Link>
          ))}
        </section>

        <section className={`${styles.card} ${styles.heroCard}`}>
          <div className={styles.heroContent}>
            <h1 className={styles.pageTitle}>
              <RubyAuto text={`こんにちは、${selected.nickname}さん！`} readingMode={readingMode} />
            </h1>
            <p className={styles.lead}>
              <RubyAuto text="きょうも たのしく さんすうを やろう！" readingMode={readingMode} />
            </p>
          </div>
          <CharacterCoach mood="happy" message="じゅんびは いいかな？" />
        </section>

        <div className={styles.grid2}>
          <Link href={startHref} className={`${styles.card} ${styles.actionCard} ${styles.primaryCard}`}>
            <BookOpen size={48} className={styles.actionIcon} />
            <h2 className={styles.cardTitle}>
              <RubyAuto text="きょうの おすすめを はじめる" readingMode={readingMode} />
            </h2>
            <p className={styles.tiny}>
              {first ? `いまのおすすめ: ${first.unit}` : "おすすめのもんだいを よういしているよ"}
            </p>
          </Link>

          <Link href={againHref} className={`${styles.card} ${styles.actionCard}`}>
            <RotateCcw size={48} className={styles.actionIcon} />
            <h2 className={styles.cardTitle}>
              <RubyAuto text="もういちど やる" readingMode={readingMode} />
            </h2>
            <p className={styles.tiny}>さいきん といたもんだいを ふくしゅうしよう</p>
          </Link>
        </div>
      </main>
    </div>
  );
}

function DemoHome() {
  return (
    <div className={styles.childShell}>
      <ChildHeader />
      <main className={styles.main}>
        <section className={`${styles.card} ${styles.heroCard}`}>
          <div className={styles.heroContent}>
            <h1 className={styles.pageTitle}>かのはアプリ</h1>
            <p className={styles.lead}>
              <RubyAuto text="まいにち 15ふん、たのしく さんすう！" readingMode="kanji_with_ruby" />
            </p>
          </div>
          <CharacterCoach mood="happy" message="こんにちは！いっしょに べんきょうしよう！" />
        </section>

        <div className={styles.grid2}>
          <Link href="/child/problem/volume-1" className={`${styles.card} ${styles.actionCard} ${styles.primaryCard}`}>
            <BookOpen size={48} className={styles.actionIcon} />
            <h2 className={styles.cardTitle}>
              <RubyAuto text="きょうの おすすめを はじめる" readingMode="kanji_with_ruby" />
            </h2>
            <p className={styles.tiny}>デモもんだい: 水のかさ(LとmL)</p>
          </Link>

          <Link href="/login" className={`${styles.card} ${styles.actionCard}`}>
            <History size={48} className={styles.actionIcon} />
            <h2 className={styles.cardTitle}>ほごしゃメニュー</h2>
            <p className={styles.tiny}>ログインしてがくしゅうをはじめよう</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
