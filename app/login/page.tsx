import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import styles from "@/components/kanoha.module.css";

export default function LoginPage() {
  return (
    <main className={styles.loginLayout}>
      <aside className={styles.loginAside}>
        <div>
          <span className={styles.brandMark}>か</span>
          <h1 className={styles.heroTitle}>毎日の「できた」を、そっと見守る。</h1>
          <p>学習の記録、苦手な単元、次の復習をひとつの画面に。</p>
        </div>
      </aside>
      <section className={styles.loginPanel}>
        <Suspense fallback={<div className={`${styles.card} ${styles.formCard}`}>読み込み中...</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
