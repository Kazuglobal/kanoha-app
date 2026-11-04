import { describe, expect, it } from "vitest";
import { DRESS_UP_TABS, OUTFIT_TAB, nextTabIndex, previewSlot, tabDomId } from "@/components/child/dressUp/tabs";
import { SLOT_IDS } from "@/lib/rewards/slots";

describe("dress-up tabs", () => {
  it("has the outfits first, then one tab per slot in the registry order", () => {
    expect(DRESS_UP_TABS.map((tab) => tab.id)).toEqual([OUTFIT_TAB, ...SLOT_IDS]);
    expect(new Set(DRESS_UP_TABS.map((tab) => tabDomId(tab.id))).size).toBe(DRESS_UP_TABS.length);
  });

  it("does not zoom the preview for the outfits, and zooms to the slot otherwise", () => {
    expect(previewSlot(OUTFIT_TAB)).toBeUndefined();
    expect(previewSlot("hat")).toBe("hat");
  });

  it("moves with the arrow keys and wraps around at both ends; Home and End jump; other keys do nothing", () => {
    expect(nextTabIndex("ArrowRight", 2, 14)).toBe(3);
    expect(nextTabIndex("ArrowRight", 13, 14)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 5, 14)).toBe(4);
    expect(nextTabIndex("ArrowLeft", 0, 14)).toBe(13);
    expect(nextTabIndex("Home", 7, 14)).toBe(0);
    expect(nextTabIndex("End", 7, 14)).toBe(13);
    for (const key of ["Enter", " ", "a", "ArrowUp", "ArrowDown", "Tab"]) expect(nextTabIndex(key, 3, 14), key).toBeNull();
  });
});
