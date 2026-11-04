"use client";

import styles from "@/components/kanoha.module.css";
import { ACCESSORY_CATALOG, type AccessoryItem, type EquippedAccessories } from "@/lib/rewards/catalog";
import { slotDefault } from "@/lib/rewards/dressUp";
import type { OutfitPreset } from "@/lib/rewards/outfits";
import { remainingCorrectForItem } from "@/lib/rewards/unlocks";
import { DressUpItemCard } from "./DressUpItemCard";
import { OutfitGrid } from "./OutfitGrid";
import { OUTFIT_TAB, panelAttributes, type DressUpTabId } from "./tabs";

interface DressUpPanelProps {
  tab: DressUpTabId;
  equipped: EquippedAccessories;
  totalCorrect: number;
  onSelectItem: (item: AccessoryItem) => void;
  onWear: (preset: OutfitPreset) => void;
}

/** 選んでいるタブの中身: コーデの一覧、または その枠のアイテムの一覧(鍵つき)。 */
export function DressUpPanel({ tab, equipped, totalCorrect, onSelectItem, onWear }: DressUpPanelProps) {
  if (tab === OUTFIT_TAB) return <OutfitGrid equipped={equipped} totalCorrect={totalCorrect} onWear={onWear} />;

  return (
    // key: 枠を替えたときは 一覧を作りなおす(前の枠のスクロール位置を引きずらない)
    <div key={tab} className={styles.dressUpItemsGrid} {...panelAttributes(tab)}>
      {ACCESSORY_CATALOG.filter((item) => item.category === tab).map((item) => (
        <DressUpItemCard
          key={item.id}
          item={item}
          active={(equipped[item.category] ?? slotDefault(item.category, equipped)) === item.id}
          remaining={remainingCorrectForItem(item, totalCorrect)}
          onSelect={onSelectItem}
        />
      ))}
    </div>
  );
}
