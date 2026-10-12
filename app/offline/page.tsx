import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <h1>オフラインです</h1>
        <p>インターネットにつながったら、もういちど学習をはじめよう。</p>
        <div className="landing-actions">
          <Link className="primary-link" href="/child/home">もういちど ためす</Link>
        </div>
      </section>
      <aside className="landing-orb" aria-label="さゆきコーチ">
        <span>さ</span>
        <small>つながるまで ひとやすみ</small>
      </aside>
    </main>
  );
}
