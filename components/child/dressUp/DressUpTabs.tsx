"use client";

import { useRef, type KeyboardEvent } from "react";
import styles from "@/components/kanoha.module.css";
import { DRESS_UP_TABS, TAB_PANEL_ID, nextTabIndex, tabDomId, type DressUpTabId } from "./tabs";

interface DressUpTabsProps {
  active: DressUpTabId;
  onSelect: (tab: DressUpTabId) => void;
}

/** タブ。矢印キー・Home・End で動かせる(選んだら すぐ切りかわる)。キーボードでは、いま選んでいるタブにだけ Tab で止まる。 */
export function DressUpTabs({ active, onSelect }: DressUpTabsProps) {
  const buttons = useRef<Partial<Record<DressUpTabId, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = DRESS_UP_TABS.findIndex((tab) => tab.id === active);
    const next = nextTabIndex(event.key, current, DRESS_UP_TABS.length);
    if (next === null) return;
    event.preventDefault();
    const tab = DRESS_UP_TABS[next];
    onSelect(tab.id);
    buttons.current[tab.id]?.focus();
  };

  return (
    <div className={styles.dressUpTabs} role="tablist" aria-label="きがえの しゅるい" onKeyDown={onKeyDown}>
      {DRESS_UP_TABS.map((tab) => (
        <button
          key={tab.id}
          ref={(element) => {
            buttons.current[tab.id] = element;
          }}
          id={tabDomId(tab.id)}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={TAB_PANEL_ID}
          tabIndex={active === tab.id ? 0 : -1}
          className={`${styles.dressUpTab} ${active === tab.id ? styles.dressUpTabActive : ""}`}
          onClick={() => onSelect(tab.id)}
        >
          <span className={styles.dressUpTabIcon} aria-hidden="true">
            {tab.icon}
          </span>{" "}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
