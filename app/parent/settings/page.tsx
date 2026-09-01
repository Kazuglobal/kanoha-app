import { ParentShell } from "@/components/parent/ParentShell";
import { ChildProfiles } from "@/components/parent/ChildProfiles";
import { MaterialManager } from "@/components/parent/MaterialManager";
import { PinSettings } from "@/components/parent/PinSettings";
import { SettingsForm } from "@/components/parent/SettingsForm";
import styles from "@/components/kanoha.module.css";
import { parentHasPin } from "@/lib/auth/pin";
import { getUser } from "@/lib/supabase/auth";

const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function loadHasPin(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const user = await getUser();
  return user ? parentHasPin(user.id) : false;
}

export default async function ParentSettingsPage() {
  const hasPin = await loadHasPin();
  return (
    <ParentShell active="settings">
      <header className={styles.parentHeader}><div><p className={styles.tiny}>家庭に合わせて調整</p><h1 className={styles.pageTitle}>設定</h1></div></header>
      <div className={styles.settingsGrid}>
        <SettingsForm />
        <ChildProfiles />
      </div>
      <PinSettings hasPin={hasPin} />
      <MaterialManager />
    </ParentShell>
  );
}
