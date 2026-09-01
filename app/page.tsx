import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <span className="eyebrow">まいにち 15ふん</span>
        <h1>
          わかった！が
          <br />
          ふえていく算数
        </h1>
        <p>かのはが、あなたにぴったりのヒントとれんしゅうをとどけるよ。</p>
        <div className="landing-actions">
          <Link className="primary-link" href="/child/home">
            子どもモードではじめる
          </Link>
          <Link className="secondary-link" href="/login">
            おうちの方はこちら
          </Link>
        </div>
      </section>
      <aside className="landing-orb" aria-label="かのはコーチ">
        <span>か</span>
        <small>いっしょにやろう</small>
      </aside>
    </main>
  );
}
