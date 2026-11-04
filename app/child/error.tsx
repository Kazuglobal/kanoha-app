"use client";

import Link from "next/link";
import { ChildHeader } from "@/components/child/ChildHeader";
import styles from "@/components/kanoha.module.css";

/**
 * 子ども画面で描画に失敗したときの画面。内部のエラー文は子どもに見せない(Next がサーバー側にも記録する)。
 * Next 16.3 の error.tsx は `retry`(再取得して描き直す)を受け取る。
 * ホームそのものが壊れても子どもモードに閉じ込められないよう、親の PIN ボタン(ChildHeader)を出しておく。
 */
export default function ChildError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className={`${styles.childShell} ${styles.appScreen}`}>
      <ChildHeader />
      <main style={{ display: "grid", gap: "1rem", justifyItems: "center", padding: "2rem 1rem" }}>
        <p aria-hidden="true" style={{ fontSize: "3rem", margin: 0 }}>
          🙈
        </p>
        <div role="alert" style={{ display: "grid", gap: "0.5rem", justifyItems: "center" }}>
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>うまく ひらけなかったよ</h1>
          <p style={{ margin: 0 }}>もういちど おしてみてね</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => retry()}>
          もういちど
        </button>
        <Link href="/child/home" className={styles.secondaryButton}>
          ホームへ もどる
        </Link>
      </main>
    </div>
  );
}
