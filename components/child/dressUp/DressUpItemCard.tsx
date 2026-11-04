"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import type { AccessoryItem } from "@/lib/rewards/catalog";

interface DressUpItemCardProps {
  item: AccessoryItem;
  /** いま着ている */
  active: boolean;
  /** かいほうまで あと何もん(正解)。0 なら つかえる */
  remaining: number;
  onSelect: (item: AccessoryItem) => void;
}

export function DressUpItemCard({ item, active, remaining, onSelect }: DressUpItemCardProps) {
  const locked = remaining > 0;
  return (
    <motion.button
      type="button"
      aria-disabled={locked}
      aria-pressed={locked ? undefined : active}
      whileHover={locked ? undefined : { scale: 1.03 }}
      whileTap={locked ? undefined : { scale: 0.96 }}
      className={`${styles.dressUpItemCard} ${active ? styles.dressUpItemCardActive : ""} ${locked ? styles.dressUpItemLocked : ""}`}
      onClick={() => {
        if (!locked) onSelect(item);
      }}
    >
      <div className={styles.dressUpItemIconWrap}>
        {item.previewImage ? (
          <Image
            src={item.previewImage}
            alt=""
            width={48}
            height={48}
            unoptimized
            style={{ width: "44px", height: "44px", objectFit: "cover", objectPosition: "top center", borderRadius: "50%" }}
          />
        ) : (
          <span className={styles.dressUpItemIcon}>{item.icon}</span>
        )}
        {active && !locked && (
          <span className={styles.dressUpCheckMark}>
            <Check size={14} />
          </span>
        )}
        {locked && (
          <span className={styles.dressUpLockOverlay}>
            <Lock size={16} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className={styles.dressUpItemMeta}>
        <strong className={styles.dressUpItemName}>{item.name}</strong>
        {locked ? (
          <span className={styles.dressUpItemUnlockNotice}>あと {remaining}もん で つかえるよ</span>
        ) : (
          <span className={styles.dressUpItemDesc}>{item.description}</span>
        )}
      </div>
    </motion.button>
  );
}
