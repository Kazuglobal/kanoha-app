import { SLOT_REGISTRY, type SlotId } from "@/lib/rewards/slots";

/** 着せかえ画面のタブ。コーデ(テーマ別のセット)と、着せかえの枠(slots.ts が正本)。 */
export const OUTFIT_TAB = "outfit" as const;

export type DressUpTabId = SlotId | typeof OUTFIT_TAB;

export interface DressUpTab {
  readonly id: DressUpTabId;
  readonly label: string;
  readonly icon: string;
}

export const DRESS_UP_TABS: readonly DressUpTab[] = [{ id: OUTFIT_TAB, label: "コーデ", icon: "🎀" }, ...SLOT_REGISTRY];

/** プレビューを寄せる枠。コーデのタブでは寄せない。 */
export const previewSlot = (tab: DressUpTabId): SlotId | undefined => (tab === OUTFIT_TAB ? undefined : tab);

/** タブと、その中身(いまのタブのアイテム一覧)を結びつける ID(中身は 1 つを使い回す)。 */
export const TAB_PANEL_ID = "dress-up-panel";
export const tabDomId = (tab: DressUpTabId): string => `dress-up-tab-${tab}`;

/** 中身(アイテム一覧・コーデ一覧)に付ける、タブパネルの属性。 */
export const panelAttributes = (tab: DressUpTabId) =>
  ({ role: "tabpanel", id: TAB_PANEL_ID, "aria-labelledby": tabDomId(tab) }) as const;

/** 矢印キー・Home・End で、次に選ぶタブの番号(両はしでは反対がわへ回る)。タブを動かさないキーは null。 */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  const last = count - 1;
  switch (key) {
    case "ArrowRight":
      return index >= last ? 0 : index + 1;
    case "ArrowLeft":
      return index <= 0 ? last : index - 1;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
