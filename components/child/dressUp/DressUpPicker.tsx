"use client";

import styles from "@/components/kanoha.module.css";
import type { AccessoryItem, EquippedAccessories } from "@/lib/rewards/catalog";
import type { OutfitPreset } from "@/lib/rewards/outfits";
import { DressUpPanel } from "./DressUpPanel";
import { DressUpTabs } from "./DressUpTabs";
import type { DressUpTabId } from "./tabs";

interface DressUpPickerProps {
  tab: DressUpTabId;
  onTab: (tab: DressUpTabId) => void;
  equipped: EquippedAccessories;
  totalCorrect: number;
  onSelectItem: (item: AccessoryItem) => void;
  onWear: (preset: OutfitPreset) => void;
}

/** 右側: タブと、そのタブの中身(コーデ・アイテム)。 */
export function DressUpPicker({ tab, onTab, equipped, totalCorrect, onSelectItem, onWear }: DressUpPickerProps) {
  return (
    <div className={styles.dressUpPickerSection}>
      <DressUpTabs active={tab} onSelect={onTab} />
      <DressUpPanel tab={tab} equipped={equipped} totalCorrect={totalCorrect} onSelectItem={onSelectItem} onWear={onWear} />
    </div>
  );
}
