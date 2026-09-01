import { BarChart3, BookImage, Settings, Upload } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "@/components/kanoha.module.css";

export function ParentShell({ children, active }: { children: ReactNode; active: "dashboard" | "upload" | "settings" }) {
  const links = [
    { id: "dashboard", href: "/parent/dashboard", label: "ダッシュボード", icon: BarChart3 },
    { id: "upload", href: "/parent/upload", label: "問題を追加", icon: Upload },
    { id: "settings", href: "/parent/settings", label: "設定", icon: Settings },
  ] as const;

  return (
    <div className={styles.parentShell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/parent/dashboard">
          <span className={styles.brandMark}>か</span>
          かのは 保護者用
        </Link>
        <nav className={styles.nav}>
          {links.map(({ id, href, label, icon: Icon }) => (
            <Link className={active === id ? styles.navActive : styles.navLink} href={href} key={id}>
              <Icon size={19} /> {label}
            </Link>
          ))}
          <Link className={styles.navLink} href="/child/home"><BookImage size={19} /> 子どもモード</Link>
          <LogoutButton />
        </nav>
      </aside>
      <main className={styles.parentMain}>{children}</main>
    </div>
  );
}
