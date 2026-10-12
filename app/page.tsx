import Link from "next/link";
import { RubyAuto } from "@/components/child/RubyText";
import { LANDING_TEXT } from "@/components/child/childStrings";
import styles from "./landing.module.css";

const POINTS = [
  { icon: "📚", label: LANDING_TEXT.pointMath, tone: styles.pointCoral },
  { icon: "💡", label: LANDING_TEXT.pointHint, tone: styles.pointSun },
  { icon: "🎁", label: LANDING_TEXT.pointReward, tone: styles.pointMint },
] as const;

/** 浮かぶ さんすう記号(かざり)。位置と色は CSS 側で決める。 */
const FLOATERS = [
  { text: "1", className: styles.floatOne },
  { text: "＋", className: styles.floatPlus },
  { text: "2", className: styles.floatTwo },
  { text: "×", className: styles.floatTimes },
  { text: "★", className: styles.floatStar },
] as const;

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">か</span>
          かのは
        </span>
        <span className={styles.timePill}>
          <span aria-hidden="true">⏱️</span>
          {LANDING_TEXT.eyebrow}
        </span>
      </header>

      <section className={styles.hero} aria-label="かのはコーチ">
        <div className={styles.orb}>
          {FLOATERS.map(({ text, className }) => (
            <span key={text} className={`${styles.floater} ${className}`} aria-hidden="true">
              {text}
            </span>
          ))}
          {/* 静的なキャラクター画像(public/images/character)。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="かのはちゃん"
            className={styles.character}
            src="/images/character/kanoha-ref-happy.png"
            fetchPriority="high"
          />
          <p className={styles.bubble}>{LANDING_TEXT.orbLabel}</p>
        </div>
      </section>

      <section className={styles.card}>
        <h1 className={styles.title}>
          <span className={styles.titleAccent}>{LANDING_TEXT.titleAccent}</span>
          {LANDING_TEXT.titleLine1Rest}
          <br />
          <RubyAuto text={LANDING_TEXT.titleLine2} readingMode="kanji_with_ruby" />
        </h1>
        <p className={styles.lead}>{LANDING_TEXT.lead}</p>

        <ul className={styles.points} aria-label="かのはの とくちょう">
          {POINTS.map(({ icon, label, tone }) => (
            <li key={label} className={`${styles.point} ${tone}`}>
              <span aria-hidden="true" className={styles.pointIcon}>{icon}</span>
              {label}
            </li>
          ))}
        </ul>

        <Link className={styles.cta} href="/child/home">
          <span>
            <RubyAuto text={LANDING_TEXT.childMode} readingMode="kanji_with_ruby" />
          </span>
          <span className={styles.ctaArrow} aria-hidden="true">▶</span>
        </Link>
        <Link className={styles.parentLink} href="/login">
          <RubyAuto text={LANDING_TEXT.parentLink} readingMode="kanji_with_ruby" />
        </Link>
      </section>
    </main>
  );
}
