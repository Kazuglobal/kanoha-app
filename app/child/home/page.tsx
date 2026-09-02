import { BookOpen, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { CharacterCoach } from "@/components/child/CharacterCoach";
import { ChildHeader } from "@/components/child/ChildHeader";
import { RubyAuto } from "@/components/child/RubyText";
import { HOME_TEXT } from "@/components/child/childStrings";
import styles from "@/components/kanoha.module.css";
import { getTodayRecommendations } from "@/lib/review/today";
import { createClient } from "@/lib/supabase/server";

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

type Supabase = Awaited<ReturnType<typeof createClient>>;

export default async function ChildHomePage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!configured) return <DemoHome />;

  const { childId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <DemoHome />;

  const { data: profiles } = await supabase.from("child_profiles")
    .select("id, nickname, reading_mode")
    .eq("user_id", user.id)
    .order("created_at");
  const children = (profiles ?? []) as ChildProfile[];
  const selected = children.find(({ id }) => id === childId) ?? children[0];
  if (!selected) return <NoProfileHome />;

  const readingMode: ReadingMode = selected.reading_mode === "hiragana" ? "hiragana" : "kanji_with_ruby";
  const [recommendation, recentProblemId] = await Promise.all([
    getTodayRecommendations(supabase, selected.id),
    loadRecentProblemId(supabase, selected.id),
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
async function loadRecentProblemId(supabase: Supabase, childId: string): Promise<string | null> {
  const { data } = await supabase.from("attempts")
    .select("problem_id, created_at")
    .eq("child_id", childId)
    .not("problem_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { problem_id?: string | null } | null)?.problem_id ?? null;
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
  // 子ども画面から親画面へは遷移しない(A1)。問題が無いときはホームに留まる。
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
        <nav aria-label="子どもをえらぶ" className={styles.childSwitcher}>
          {profiles.map((child) => (
            <Link
              className={child.id === selected.id ? styles.childChipActive : styles.childChip}
              href={`/child/home?childId=${child.id}`}
              key={child.id}
            >
              {child.nickname}
            </Link>
          ))}
        </nav>
        <section className={styles.heroGrid}>
          <div>
            <h1 className={styles.heroTitle}>
              {selected.nickname}さん、<br /><em>{HOME_TEXT.heroLine2}</em><br />{HOME_TEXT.heroLine3}
            </h1>
            <p className={styles.lead}>
              {first ? (
                <RubyAuto
                  readingMode={readingMode}
                  text={`${HOME_TEXT.leadPrefix}${first.unit}${HOME_TEXT.leadSuffix}`}
                />
              ) : (
                <RubyAuto readingMode={readingMode} text={HOME_TEXT.noProblemsLead} />
              )}
            </p>
          </div>
          <CharacterCoach message={first ? HOME_TEXT.coachStart : HOME_TEXT.coachWaiting} />
        </section>
        <section className={styles.actionGrid}>
          <Link className={styles.bigAction} href={startHref}>
            <BookOpen className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>
              {first ? HOME_TEXT.startRecommended : HOME_TEXT.addProblems}
            </span>
            <span className={styles.actionNote}>
              {first
                ? <><RubyAuto readingMode={readingMode} text={first.unit} /> · {first.estimatedMinutes}ぷん</>
                : HOME_TEXT.withParent}
            </span>
          </Link>
          <Link className={styles.bigActionSecondary} href={startHref}>
            <History className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>{HOME_TEXT.review}</span>
            <span className={styles.actionNote}>{problems.length}もん えらんだよ</span>
          </Link>
          <Link className={styles.bigActionSecondary} href={againHref}>
            <RotateCcw className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>{HOME_TEXT.again}</span>
            <span className={styles.actionNote}>もういちど といてみよう</span>
          </Link>
        </section>
        <section className={styles.recommendationList}>
          <h2 className={styles.sectionTitle}>{HOME_TEXT.recommendedHeading}</h2>
          {problems.length === 0 ? (
            <p className={styles.tiny}>
              <RubyAuto readingMode={readingMode} text={HOME_TEXT.noRecommendations} />
            </p>
          ) : null}
          {problems.map((problem, index) => (
            <Link
              className={styles.recommendationRow}
              href={`/child/problem/${problem.id}?childId=${selected.id}`}
              key={problem.id}
            >
              <span>
                <strong>{index + 1}. <RubyAuto readingMode={readingMode} text={problem.problem_text} /></strong>
                <br />
                <small><RubyAuto readingMode={readingMode} text={problem.unit} /></small>
              </span>
              <span className={styles.tag}>{problem.estimatedMinutes}ぷん</span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

function DemoHome() {
  return (
    <div className={styles.childShell}>
      <ChildHeader />
      <main className={styles.main}>
        <section className={styles.heroGrid}>
          <div>
            <h1 className={styles.heroTitle}>
              かのはさん、<br /><em>{HOME_TEXT.heroLine2}</em><br />{HOME_TEXT.heroLine3}
            </h1>
            <p className={styles.lead}>
              <RubyAuto
                readingMode="kanji_with_ruby"
                text={`${HOME_TEXT.leadPrefix}かさ${HOME_TEXT.leadSuffix}`}
              />
            </p>
          </div>
          <CharacterCoach message={HOME_TEXT.coachStart} />
        </section>
        <section className={styles.actionGrid}>
          <Link className={styles.bigAction} href="/child/problem/volume-1">
            <BookOpen className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>{HOME_TEXT.startRecommended}</span>
            <span className={styles.actionNote}>{HOME_TEXT.demoStartNote}</span>
          </Link>
          <Link className={styles.bigActionSecondary} href="/child/problem/volume-1">
            <History className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>{HOME_TEXT.review}</span>
            <span className={styles.actionNote}>{HOME_TEXT.demoReviewNote}</span>
          </Link>
          <Link className={styles.bigActionSecondary} href="/child/problem/volume-1">
            <RotateCcw className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>{HOME_TEXT.again}</span>
            <span className={styles.actionNote}>{HOME_TEXT.demoAgainNote}</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
