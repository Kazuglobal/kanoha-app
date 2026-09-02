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
        <div className="landing-actions">
          <Link className="primary-link" href="/child/home">
            <RubyAuto text={LANDING_TEXT.childMode} readingMode="kanji_with_ruby" />
          </Link>
          <Link className="secondary-link" href="/login">
            <RubyAuto text={LANDING_TEXT.parentLink} readingMode="kanji_with_ruby" />
          </Link>
        </div>
      </section>
      <aside className="landing-orb" aria-label="かのはコーチ">
        <span>か</span>
        <small>{LANDING_TEXT.orbLabel}</small>
      </aside>
    </main>
  );
}
