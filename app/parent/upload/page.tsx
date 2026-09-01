import { ParentShell } from "@/components/parent/ParentShell";
import { UploadMaterials } from "@/components/parent/UploadMaterials";
import styles from "@/components/kanoha.module.css";

export default function ParentUploadPage() {
  return (
    <ParentShell active="upload">
      <header className={styles.parentHeader}><div><p className={styles.tiny}>AIが問題を読み取ります</p><h1 className={styles.pageTitle}>問題を追加</h1></div></header>
      <UploadMaterials />
    </ParentShell>
  );
}
