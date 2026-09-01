import { ParentShell } from "@/components/parent/ParentShell";
import { ChildProfiles } from "@/components/parent/ChildProfiles";
import { MaterialManager } from "@/components/parent/MaterialManager";
import { SettingsForm } from "@/components/parent/SettingsForm";
import styles from "@/components/kanoha.module.css";

export default function ParentSettingsPage() {
  return (
    <ParentShell active="settings">
      <header className={styles.parentHeader}><div><p className={styles.tiny}>家庭に合わせて調整</p><h1 className={styles.pageTitle}>設定</h1></div></header>
      <div className={styles.settingsGrid}>
        <SettingsForm />
        <ChildProfiles />
      </div>
      <MaterialManager />
    </ParentShell>
  );
}
