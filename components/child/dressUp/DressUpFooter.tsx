"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import styles from "@/components/kanoha.module.css";

interface DressUpFooterProps {
  /** サーバーに保存できなかった(端末には残してあり、あとで送り直す) */
  saveFailed: boolean;
  onReset: () => void;
  onDone: () => void;
}

/** 下のボタン(いつもの ふく / できた)と、保存のおしらせ。おしらせの場所は 読み上げのために 常に置いておく(空のときは場所を取らない)。 */
export function DressUpFooter({ saveFailed, onReset, onDone }: DressUpFooterProps) {
  return (
    <>
      <p className={styles.dressUpSaveNote} role="status">
        {saveFailed ? "ほぞんは あとで もういちど するね" : ""}
      </p>

      <div className={styles.dressUpFooter}>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onReset}
          style={{ minWidth: "140px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          title="ぜんぶ いつもの スタイルに もどす"
        >
          <RotateCcw size={16} />
          いつもの ふく
        </button>
        <button className={styles.primaryButton} type="button" onClick={onDone} style={{ minWidth: "180px" }}>
          <Sparkles size={18} />
          できた！ これにする！
        </button>
      </div>
    </>
  );
}
