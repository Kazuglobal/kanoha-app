import { Award, CalendarCheck, Target } from "lucide-react";
import Link from "next/link";
import { CharacterCoach } from "@/components/child/CharacterCoach";
import { ChildHeader } from "@/components/child/ChildHeader";
import { RewardBurst } from "@/components/child/RewardBurst";
import styles from "@/components/kanoha.module.css";

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ score?: string; unit?: string }> }) {
  const { score = "5", unit = "かさ" } = await searchParams;
  const mastered = Number(score) >= 4;
  return (
    <div className={styles.childShell}>
      <ChildHeader />
      <main className={styles.narrow}>
        <section className={`${styles.card} ${styles.resultHero}`}>
          <CharacterCoach message={mastered ? "さいごまで できたね！" : "がんばったことが いちばんだよ！"} mood="celebrate" />
          {mastered ? <RewardBurst unit={unit} /> : null}
          <h1 className={styles.pageTitle}>{mastered ? `${unit}、できた！` : "きょうも よくがんばった！"}</h1>
          <p className={styles.score}>{score}/5</p>
          <div className={styles.resultGrid}>
            <div className={styles.stat}><Award size={25} /><strong>{mastered ? "できた" : "れんしゅう中"}</strong><span>{unit}</span></div>
            <div className={styles.stat}><Target size={25} /><strong>{Number(score) * 20}%</strong><span>せいかい</span></div>
            <div className={styles.stat}><CalendarCheck size={25} /><strong>4日</strong><span>つづいたよ</span></div>
          </div>
          <p className={styles.lead}>たんいを よく見て、さいごまで かんがえられたね。</p>
          <Link className={styles.primaryButton} href="/child/home">ホームに もどる</Link>
        </section>
      </main>
    </div>
  );
}
