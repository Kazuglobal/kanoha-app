import Link from "next/link";
import { RubyAuto } from "@/components/child/RubyText";
import { LANDING_TEXT } from "@/components/child/childStrings";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <span className="eyebrow">{LANDING_TEXT.eyebrow}</span>
        <h1>
          {LANDING_TEXT.titleLine1}
          <br />
          <RubyAuto text={LANDING_TEXT.titleLine2} readingMode="kanji_with_ruby" />
        </h1>
        <p>{LANDING_TEXT.lead}</p>
        <ul className="landing-points" aria-label="かのはの とくちょう">
          <li><span aria-hidden="true">🧮</span>{LANDING_TEXT.pointMath}</li>
          <li><span aria-hidden="true">💡</span>{LANDING_TEXT.pointHint}</li>
          <li><span aria-hidden="true">⏱️</span>{LANDING_TEXT.pointTime}</li>
        </ul>
        <div className="landing-actions">
          <Link className="primary-link" href="/child/home">
            <RubyAuto text={LANDING_TEXT.childMode} readingMode="kanji_with_ruby" />
            <span className="link-arrow" aria-hidden="true">▶</span>
          </Link>
          <Link className="secondary-link" href="/login">
            <RubyAuto text={LANDING_TEXT.parentLink} readingMode="kanji_with_ruby" />
          </Link>
        </div>
      </section>

      <aside className="landing-orb" aria-label="かのはコーチ">
        {/* Floating Sparks */}
        <div className="orb-sparkles" aria-hidden="true">
          <span className="sparkle-1">✦</span>
          <span className="sparkle-2">✨</span>
          <span className="sparkle-3">★</span>
        </div>

        {/* Mascot Face & Sprout inside Orb */}
        <div className="orb-mascot" aria-hidden="true">
          <div className="orb-sprout">
            <svg viewBox="0 0 40 30" width="40" height="30" fill="none">
              <path d="M20 28 C20 18 24 10 32 8 C34 14 30 20 22 25" fill="#a3e635" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
              <path d="M20 28 C18 19 12 14 4 13 C4 19 10 24 18 26" fill="#a3e635" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="orb-letter">か</span>
          <div className="orb-cheeks">
            <span className="cheek left" />
            <span className="cheek right" />
          </div>
        </div>

        <small>{LANDING_TEXT.orbLabel}</small>
      </aside>
    </main>
  );
}
