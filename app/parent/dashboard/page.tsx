import { CheckCircle2, Clock3, Flame, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ParentShell } from "@/components/parent/ParentShell";
import styles from "@/components/kanoha.module.css";
import { buildDashboard } from "@/lib/reports/dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const { childId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profiles } = await supabase.from("child_profiles")
    .select("id, nickname")
    .eq("user_id", user!.id)
    .order("created_at");
  const children = profiles ?? [];
  const selected = children.find(({ id }) => id === childId) ?? children[0];

  if (!selected) {
    return (
      <ParentShell active="dashboard">
        <section className={styles.panel}>
          <h1 className={styles.pageTitle}>子どもプロフィールを作成してください</h1>
          <Link className={styles.primaryButton} href="/parent/settings">設定へ</Link>
        </section>
      </ParentShell>
    );
  }

  const [sessions, attempts, weaknesses, reviews] = await Promise.all([
    supabase.from("learning_sessions")
      .select("started_at, duration_seconds").eq("child_id", selected.id).order("started_at", { ascending: false }).limit(90),
    supabase.from("attempts")
      .select("created_at, hint_level_used, is_correct, mistake_type, problem_id, similar_problem_id")
      .eq("child_id", selected.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("weakness_map")
      .select("unit, sub_unit, accuracy_rate, mistake_count, mastery_level").eq("child_id", selected.id),
    supabase.from("review_schedule")
      .select("problem_id, unit, sub_unit, scheduled_for, status").eq("child_id", selected.id),
  ]);
  const problemIds = [...new Set((attempts.data ?? []).flatMap((attempt) => attempt.problem_id ? [attempt.problem_id] : []))];
  const similarIds = [...new Set((attempts.data ?? []).flatMap((attempt) => attempt.similar_problem_id ? [attempt.similar_problem_id] : []))];
  const [problems, similarProblems] = await Promise.all([
    problemIds.length
      ? supabase.from("problems").select("id, problem_text, unit").in("id", problemIds)
      : Promise.resolve({ data: [] }),
    similarIds.length
      ? supabase.from("generated_similar_problems").select("id, problem_text, unit").in("id", similarIds)
      : Promise.resolve({ data: [] }),
  ]);
  const report = buildDashboard({
    attempts: attempts.data ?? [],
    problems: problems.data ?? [],
    reviews: reviews.data ?? [],
    sessions: sessions.data ?? [],
    similarProblems: similarProblems.data ?? [],
    weaknesses: weaknesses.data ?? [],
  });

  return (
    <ParentShell active="dashboard">
      <header className={styles.parentHeader}>
        <div><p className={styles.tiny}>{selected.nickname}さんの学習レポート</p><h1 className={styles.pageTitle}>今日の学び</h1></div>
        <nav aria-label="子どもを選ぶ" className={styles.childSwitcher}>
          {children.map((child) => (
            <Link className={child.id === selected.id ? styles.childChipActive : styles.childChip} href={`/parent/dashboard?childId=${child.id}`} key={child.id}>
              {child.nickname}
            </Link>
          ))}
        </nav>
      </header>
      <div className={styles.reportSequence}>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>1. 今日やった問題</h2>
          <strong className={styles.reportValue}>{report.todayQuestionCount}問</strong>
          {report.todayAttempts.length === 0 ? <p className={styles.tiny}>今日はまだ学習していません。</p> : null}
          <div className={styles.list}>
            {report.todayAttempts.map((attempt, index) => (
              <div className={styles.listRow} key={`${attempt.question}-${index}`}>
                <span>{attempt.question}<br /><small className={styles.tiny}>{attempt.unit} · {attempt.hintLevel ? `ヒント${attempt.hintLevel}` : "ヒントなし"}</small></span>
                <span className={styles.tag}>{attempt.isCorrect ? "正解" : "復習"}</span>
              </div>
            ))}
          </div>
        </section>
        <ReportMetric index={2} label="正答率" value={`${Math.round(report.accuracyRate * 100)}%`} />
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>3. 苦手単元</h2>
          {report.weaknesses.length === 0 ? <p className={styles.tiny}>苦手単元はまだありません。</p> : null}
          {report.weaknesses.map((weakness) => (
            <div className={styles.weakBar} key={`${weakness.unit}-${weakness.sub_unit}`}>
              <strong>{[weakness.unit, weakness.sub_unit].filter(Boolean).join(" · ")}</strong>
              <div><i style={{ width: `${Math.round(weakness.accuracy_rate * 100)}%` }} /></div>
              <small className={styles.tiny}>正答率 {Math.round(weakness.accuracy_rate * 100)}%</small>
            </div>
          ))}
        </section>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>4. 間違え方の傾向</h2>
          <p><Flame size={20} color="#ff6b57" /> {report.commonMistake}</p>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>5. 今週の成長</h2>
          <p><TrendingUp size={20} color="#0d9f8c" /> 今週の正答率は {Math.round(report.growth.currentAccuracy * 100)}% です。</p>
          <p><CheckCircle2 size={20} color="#0d9f8c" /> できた単元は {report.growth.masteredUnits} 個です。</p>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>6. 次にやるべき復習</h2>
          <p><Clock3 size={20} /> {report.dueReview ? `${report.dueReview.date}: ${report.dueReview.label}` : "予定されている復習はありません。"}</p>
        </section>
        <ReportMetric index={7} label="学習時間" value={`${report.studyMinutes}分`} />
        <ReportMetric index={8} label="連続学習日数" value={`${report.streakDays}日`} />
      </div>
    </ParentShell>
  );
}

function ReportMetric({ index, label, value }: { index: number; label: string; value: string }) {
  return <section className={styles.panel}><h2 className={styles.sectionTitle}>{index}. {label}</h2><strong className={styles.reportValue}>{value}</strong></section>;
}
