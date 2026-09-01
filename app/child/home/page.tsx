import { BookOpen, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { CharacterCoach } from "@/components/child/CharacterCoach";
import { ChildHeader } from "@/components/child/ChildHeader";
import styles from "@/components/kanoha.module.css";
import { getTodayRecommendations } from "@/lib/review/today";
import { createClient } from "@/lib/supabase/server";

interface ChildProfile {
  id: string;
  nickname: string;
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
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!configured) return <DemoHome />;

  const { childId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <DemoHome />;

  const { data: profiles } = await supabase.from("child_profiles")
    .select("id, nickname")
    .eq("user_id", user.id)
    .order("created_at");
  const children = (profiles ?? []) as ChildProfile[];
  const selected = children.find(({ id }) => id === childId) ?? children[0];

  if (!selected) {
    return (
      <div className={styles.childShell}>
        <ChildHeader />
        <main className={styles.narrow}>
          <section className={`${styles.card} ${styles.resultHero}`}>
            <h1 className={styles.pageTitle}>プロフィールを つくろう</h1>
            <p className={styles.lead}>おうちのかたに、子どもプロフィールを作ってもらってね。</p>
          </section>
        </main>
      </div>
    );
  }

  const recommendation = await getTodayRecommendations(supabase, selected.id);
  return (
    <RealHome
      profiles={children}
      problems={recommendation.error ? [] : recommendation.problems}
      selected={selected}
    />
  );
}

function RealHome({
  profiles,
  problems,
  selected,
}: {
  profiles: ChildProfile[];
  problems: RecommendedProblem[];
  selected: ChildProfile;
}) {
  const first = problems[0];
  // 子ども画面から親画面へは遷移しない(A1)。問題が無いときはホームに留まる。
  const startHref = first
    ? `/child/problem/${first.id}?childId=${selected.id}` as const
    : `/child/home?childId=${selected.id}` as const;

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
            <h1 className={styles.heroTitle}>{selected.nickname}さん、<br /><em>きょうも いっしょに</em><br />やってみよう！</h1>
            <p className={styles.lead}>
              {first
                ? `きょうは「${first.unit}」の おすすめもんだい。ゆっくり かんがえれば だいじょうぶ。`
                : "まだ問題がないよ。おうちのかたに問題を追加してもらおう。"}
            </p>
          </div>
          <CharacterCoach message={first ? "まずは 1もん。いっしょに やろう！" : "もんだいを まっているよ！"} />
        </section>
        <section className={styles.actionGrid}>
          <Link className={styles.bigAction} href={startHref}>
            <BookOpen className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>{first ? "きょうの おすすめを はじめる" : "もんだいを ついかする"}</span>
            <span className={styles.actionNote}>{first ? `${first.unit} · ${first.estimatedMinutes}ぷん` : "おうちのかたと いっしょに"}</span>
          </Link>
          <Link className={styles.bigActionSecondary} href={startHref}>
            <History className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>ふくしゅう</span>
            <span className={styles.actionNote}>{problems.length}もん えらんだよ</span>
          </Link>
          <Link className={styles.bigActionSecondary} href={startHref}>
            <RotateCcw className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>もういちど</span>
            <span className={styles.actionNote}>{first?.problem_text ?? "もんだいを ついかしよう"}</span>
          </Link>
        </section>
        <section className={styles.recommendationList}>
          <h2 className={styles.sectionTitle}>きょうの おすすめ</h2>
          {problems.length === 0 ? <p className={styles.tiny}>おすすめ問題はまだありません。</p> : null}
          {problems.map((problem, index) => (
            <Link
              className={styles.recommendationRow}
              href={`/child/problem/${problem.id}?childId=${selected.id}`}
              key={problem.id}
            >
              <span><strong>{index + 1}. {problem.problem_text}</strong><br /><small>{problem.unit}</small></span>
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
            <h1 className={styles.heroTitle}>かのはさん、<br /><em>きょうも いっしょに</em><br />やってみよう！</h1>
            <p className={styles.lead}>きょうは「かさ」の おすすめもんだい。ゆっくり かんがえれば だいじょうぶ。</p>
          </div>
          <CharacterCoach message="まずは 1もん。いっしょに やろう！" />
        </section>
        <section className={styles.actionGrid}>
          <Link className={styles.bigAction} href="/child/problem/volume-1">
            <BookOpen className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>きょうの おすすめを はじめる</span>
            <span className={styles.actionNote}>かさ · 5〜10ぷん</span>
          </Link>
          <Link className={styles.bigActionSecondary} href="/child/problem/volume-1">
            <History className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>ふくしゅう</span>
            <span className={styles.actionNote}>きょうは 1もん</span>
          </Link>
          <Link className={styles.bigActionSecondary} href="/child/problem/volume-1">
            <RotateCcw className={styles.actionIcon} aria-hidden="true" />
            <span className={styles.actionTitle}>もういちど</span>
            <span className={styles.actionNote}>きのうの もんだい</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
