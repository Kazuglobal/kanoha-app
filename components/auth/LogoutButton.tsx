"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "@/components/kanoha.module.css";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await createClient().auth.signOut({ scope: "local" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button className={styles.navButton} type="button" onClick={handleLogout}>
      <LogOut size={19} /> ログアウト
    </button>
  );
}
