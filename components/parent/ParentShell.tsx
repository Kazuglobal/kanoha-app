import { BarChart3, BookImage, Settings, Upload } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "@/components/kanoha.module.css";
import { parentHasPin } from "@/lib/auth/pin";
import { getUser } from "@/lib/supabase/auth";

type PinState = "set" | "unset" | "unknown";

const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** PIN の有無(A1)。Supabase 未設定や未ログインでは判定しない。 */
async function loadPinState(): Promise<PinState> {
  if (!isSupabaseConfigured()) return "unknown";
  const user = await getUser();
  if (!user) return "unknown";
  return (await parentHasPin(user.id)) ? "set" : "unset";
}

export async function ParentShell({ children, active }: { children: ReactNode; active: "dashboard" | "upload" | "settings" }) {
  const pinState = await loadPinState();
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
        {pinState === "unset" ? (
          <p className={styles.tiny} role="note">
            子どもモードを使うには親PINの登録が必要です。<Link href="/parent/settings">設定で登録する</Link>
          </p>
        ) : null}
      </aside>
      <main className={styles.parentMain}>{children}</main>
    </div>
  );
}
