"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "@/components/kanoha.module.css";
import { signOut } from "@/lib/auth/auth-client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await signOut();
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
