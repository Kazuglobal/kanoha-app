import { Home, Settings } from "lucide-react";
import Link from "next/link";
import styles from "@/components/kanoha.module.css";

export function ChildHeader({ progress }: { progress?: string }) {
  return (
    <header className={styles.topbar}>
      <Link className={styles.brand} href="/child/home">
        <span className={styles.brandMark}>か</span>
        かのは
      </Link>
      <div className={styles.topActions}>
        {progress ? <strong>{progress}</strong> : null}
        <Link className={styles.ghostButton} href="/child/home" aria-label="ホーム">
          <Home size={20} />
        </Link>
        <Link className={styles.ghostButton} href="/parent/dashboard" aria-label="おうちのかたの画面">
          <Settings size={20} />
        </Link>
      </div>
    </header>
  );
}

