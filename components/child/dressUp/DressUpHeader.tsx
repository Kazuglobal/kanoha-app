import { Shirt } from "lucide-react";
import styles from "@/components/kanoha.module.css";

/** 着せかえ画面の見出し(いま着せかえ中のキャラクターの名前つき)。 */
export function DressUpHeader({ characterName, titleId }: { characterName: string; titleId: string }) {
  return (
    <div className={styles.dressUpHeader}>
      <div className={styles.dressUpBadge}>
        <Shirt size={16} />
        <span>きがえ クローゼット</span>
      </div>
      <h2 className={styles.dressUpTitle} id={titleId}>
        {characterName}を コーディネート！
      </h2>
      <p className={styles.dressUpSub}>コーデを ワンタップで きたり、ひとつずつ じゆうに えらんでね！</p>
    </div>
  );
}
