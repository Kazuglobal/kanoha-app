import { CheckCircle2, Clock3, Flame, TrendingUp } from "lucide-react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ParentShell } from "@/components/parent/ParentShell";
import { ParentRewardManager } from "@/components/parent/ParentRewardManager";
import styles from "@/components/kanoha.module.css";
import { buildDashboard, loadDashboardInput } from "@/lib/reports/dashboard";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const { childId } = await searchParams;
  const session = await getServerSession();
  if (!session?.user) {
    return (
      <ParentShell active="dashboard">
        <section className={styles.panel}>
          <h1 className={styles.pageTitle}>ログインしてください</h1>
          <Link className={styles.primaryButton} href="/login">
            ログインへ
          </Link>
        </section>
      </ParentShell>
    );
  }

  const db = getDb();
  const profiles = await db
    .select({
      id: schema.childProfiles.id,
      nickname: schema.childProfiles.nickname,
    })
    .from(schema.childProfiles)
    .where(eq(schema.childProfiles.userId, session.user.id))
    .orderBy(schema.childProfiles.createdAt)
    .all();

  const children = profiles ?? [];
  const selected = children.find(({ id }) => id === childId) ?? children[0];

  if (!selected) {
    return (
      <ParentShell active="dashboard">
        <section className={styles.panel}>
          <h1 className={styles.pageTitle}>子どもプロフィールを作成してください</h1>
          <Link className={styles.primaryButton} href="/parent/settings">
            設定へ
          </Link>
        </section>
      </ParentShell>
    );
  }

  const input = await loadDashboardInput(selected.id, db);
  const report = buildDashboard(
    input ?? {
      attempts: [],
      problems: [],
      reviews: [],
      sessions: [],
      similarProblems: [],
      weaknesses: [],
    },
  );

  return (
    <ParentShell active="dashboard">
      <header className={styles.parentHeader}>
        <div>
          <p className={styles.tiny}>{selected.nickname}さんの学習レポート</p>
          <h1 className={styles.pageTitle}>今日の学び</h1>
        </div>
        <nav aria-label="子どもを選ぶ" className={styles.childSwitcher}>
          {children.map((child) => (
            <Link
              className={child.id === selected.id ? styles.childChipActive : styles.childChip}
              href={`/parent/dashboard?childId=${child.id}`}
              key={child.id}
            >
              {child.nickname}
            </Link>
          ))}
        </nav>
      </header>
      <div className={styles.reportSequence}>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>1. 今日やった問題</h2>
          <strong className={styles.reportValue}>{report.todayQuestionCount}問</strong>
          {report.todayAttempts.length === 0 ? (
            <p className={styles.tiny}>今日はまだ学習していません。</p>
          ) : null}
          <div className={styles.list}>
            {report.todayAttempts.map((attempt, index) => (
              <div className={styles.listRow} key={`${attempt.question}-${index}`}>
                <span>
                  {attempt.question}
                  <br />
                  <small className={styles.tiny}>
                    {attempt.unit} · {attempt.hintLevel ? `ヒント${attempt.hintLevel}` : "ヒントなし"}
                  </small>
                </span>
                <span className={styles.tag}>{attempt.isCorrect ? "正解" : "復習"}</span>
              </div>
            ))}
          </div>
        </section>
        <ReportMetric index={2} label="正答率" value={`${Math.round(report.accuracyRate * 100)}%`} />
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>3. 苦手単元</h2>
          {report.weaknesses.length === 0 ? (
            <p className={styles.tiny}>苦手単元はまだありません。</p>
          ) : null}
          {report.weaknesses.map((weakness) => (
            <div className={styles.weakBar} key={`${weakness.unit}-${weakness.sub_unit}`}>
              <strong>{[weakness.unit, weakness.sub_unit].filter(Boolean).join(" · ")}</strong>
              <div>
                <i style={{ width: `${Math.round(weakness.accuracy_rate * 100)}%` }} />
              </div>
              <small className={styles.tiny}>正答率 {Math.round(weakness.accuracy_rate * 100)}%</small>
            </div>
          ))}
        </section>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>4. 間違え方の傾向</h2>
          <p>
            <Flame size={20} color="#ff6b57" /> {report.commonMistake}
          </p>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>5. 今週の成長</h2>
          <p>
            <TrendingUp size={20} color="#0d9f8c" /> 今週の正答率は {Math.round(report.growth.currentAccuracy * 100)}% です。
          </p>
          <p>
            <CheckCircle2 size={20} color="#0d9f8c" /> できた単元は {report.growth.masteredUnits} 個です。
          </p>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>6. 次にやるべき復習</h2>
          <p>
            <Clock3 size={20} />{" "}
            {report.dueReview
              ? `${report.dueReview.date}: ${report.dueReview.label}`
              : "予定されている復習はありません。"}
          </p>
        </section>
        <ReportMetric index={7} label="学習時間" value={`${report.studyMinutes}分`} />
        <ReportMetric index={8} label="連続学習日数" value={`${report.streakDays}日`} />
      </div>
      <ParentRewardManager />
    </ParentShell>
  );
}

function ReportMetric({ index, label, value }: { index: number; label: string; value: string }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>
        {index}. {label}
      </h2>
      <strong className={styles.reportValue}>{value}</strong>
    </section>
  );
}
