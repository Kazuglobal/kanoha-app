import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterDressUpModal } from "@/components/child/CharacterDressUpModal";
import { DEFAULT_EQUIPPED, getEquippedAccessories, saveEquippedAccessories } from "@/lib/rewards/characterGrowthStore";
import { flushEquippedSave } from "@/lib/rewards/rewardSync";
import { saveRewardState } from "@/lib/rewards/rewardStore";

vi.mock("@/lib/audio/soundSystem", () => ({
  soundManager: { playCorrect: vi.fn(), playTap: vi.fn(), playCelebrate: vi.fn() },
}));

const CHILD = "33333333-3333-4333-8333-333333333333";
const OTHER_CHILD = "44444444-4444-4444-8444-444444444444";

const saved = (equipped: unknown) =>
  new Response(JSON.stringify({ success: true, data: { reward: {}, equipped, stored: true, rejected: [] } }), { status: 200 });

const setLevel = (totalCorrectCount: number) =>
  saveRewardState({ currentCycleCount: totalCorrectCount % 10, totalCorrectCount, totalRewardYen: 0 });

const openTab = (name: RegExp) => fireEvent.click(screen.getByRole("tab", { name }));
const card = (name: RegExp) => screen.getByRole("button", { name });
const puts = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
/** PUT で送った「変えた枠」だけ */
const putBodies = (fetchMock: ReturnType<typeof vi.fn>) => puts(fetchMock).map(([, init]) => JSON.parse(String(init.body)).equipped);

describe("CharacterDressUpModal", () => {
  const fetchMock = vi.fn();
  const onClose = vi.fn();

  /** childId に null を渡すと、子どもが開かれていない(デモ) */
  const renderOpen = (childId: string | null = CHILD) => render(<CharacterDressUpModal isOpen childId={childId ?? undefined} onClose={onClose} />);
  const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

  beforeEach(() => {
    localStorage.clear();
    // 共有の「いま開いている子」がちがう子でも、保存先は この画面の子
    localStorage.setItem("kanoha_active_child_v1", OTHER_CHILD);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      saved({ ...DEFAULT_EQUIPPED, ...(JSON.parse(String(init?.body ?? "{}")).equipped ?? {}) }),
    );
    onClose.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    setLevel(0);
  });

  afterEach(async () => {
    await act(async () => void (await flushEquippedSave()));
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("has a tab for every slot, plus the themed outfits", () => {
    renderOpen();
    const names = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(names).toHaveLength(14);
    for (const label of ["コーデ", "キャラ", "ぼうし", "エフェクト", "ペット", "うごき"]) {
      expect(names.some((name) => name?.includes(label)), label).toBe(true);
    }
  });

  it("shows a lock and how many more correct answers it takes, and ignores taps on a locked item", async () => {
    renderOpen();
    openTab(/ぼうし/);
    const crown = card(/きんのクラウン/);
    expect(crown).toHaveAttribute("aria-disabled", "true");
    expect(within(crown).getByText(/あと 50もん/)).toBeInTheDocument();

    fireEvent.click(crown);
    await wait(1000);

    expect(getEquippedAccessories().hat).toBe("hat_none");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens items as the level goes up (new slots included)", () => {
    setLevel(5); // Lv.2
    renderOpen();
    openTab(/エフェクト/);
    expect(card(/キラキラ/)).not.toHaveAttribute("aria-disabled", "true");
    expect(card(/シャボンだま/)).toHaveAttribute("aria-disabled", "true");
  });

  it("puts an unlocked item on at once, and saves only the changed slot, in one request, to its own child, after a short wait", async () => {
    renderOpen();
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));

    expect(getEquippedAccessories().hat).toBe("hat_safari");
    await wait(399);
    expect(fetchMock).not.toHaveBeenCalled();
    await wait(2);

    expect(putBodies(fetchMock)).toEqual([{ hat: "hat_safari" }]);
    expect(String(puts(fetchMock)[0][0])).toBe(`/api/children/${CHILD}/rewards`);
  });

  it("takes the item off when the worn one is tapped again", async () => {
    renderOpen();
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));
    fireEvent.click(card(/たんけんぼう/));
    await wait(500);
    expect(getEquippedAccessories().hat).toBe("hat_none");
    expect(putBodies(fetchMock)).toEqual([{ hat: "hat_none" }]);
  });

  it("switches character with one request (not one per slot), carrying her own hair along", async () => {
    renderOpen();
    fireEvent.click(card(/ふわり/));
    await wait(500);

    expect(putBodies(fetchMock)).toEqual([{ character: "char_fuwari", hairstyle: "hair_fluffy", hair_color: "hair_color_silver" }]);
  });

  it("wears a themed outfit with one request, and locks the ones that are not open yet", async () => {
    renderOpen();
    openTab(/コーデ/);

    const hero = card(/ゆうしゃ/);
    expect(hero).toHaveAttribute("aria-disabled", "true");
    expect(within(hero).getByText(/あと 50もん/)).toBeInTheDocument();
    fireEvent.click(hero);

    fireEvent.click(card(/おでかけ/));
    await wait(500);

    expect(putBodies(fetchMock)).toEqual([{ hat: "hat_safari", accessory: "acc_bag_bear", pet: "pet_cat" }]);
    expect(getEquippedAccessories()).toMatchObject({ hat: "hat_safari", pet: "pet_cat" });
  });

  it("marks the outfit that is being worn (it is the current one, not a toggle)", async () => {
    renderOpen();
    openTab(/コーデ/);
    fireEvent.click(card(/おでかけ/));
    expect(card(/おでかけ/)).toHaveAttribute("aria-current", "true");
    expect(card(/がっこう/)).not.toHaveAttribute("aria-current");
    expect(card(/おでかけ/)).not.toHaveAttribute("aria-pressed");
  });

  it("goes back to the usual look with one request, including effect, pet and motion", async () => {
    saveRewardState({ currentCycleCount: 0, totalCorrectCount: 300, totalRewardYen: 150 });
    renderOpen();
    openTab(/ペット/);
    fireEvent.click(card(/ドラゴン/));
    await wait(500);
    fetchMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /いつもの ふく/ }));
    await wait(500);

    expect(putBodies(fetchMock)).toEqual([{ pet: "pet_none" }]);
    expect(getEquippedAccessories()).toEqual(DEFAULT_EQUIPPED);
  });

  it("does not send anything when nothing changed (wearing what is already worn)", async () => {
    renderOpen();
    openTab(/コーデ/);
    fireEvent.click(card(/おでかけ/));
    await wait(500);
    fetchMock.mockClear();

    fireEvent.click(card(/おでかけ/));
    await wait(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the save will be retried later, without any alarm, when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    renderOpen();
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));
    await wait(500);

    const note = screen.getByRole("status");
    expect(note).toHaveTextContent("ほぞんは あとで もういちど するね");
    expect(getEquippedAccessories().hat).toBe("hat_safari"); // 見た目はそのまま
  });

  it("keeps changes on the device only, and says nothing about saving, when no child is open (demo)", async () => {
    renderOpen(null);
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));
    await wait(1000);

    expect(getEquippedAccessories().hat).toBe("hat_safari");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("takes the note away again once a later save goes through", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    renderOpen();
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));
    await wait(500);
    expect(screen.getByRole("status")).toHaveTextContent("ほぞんは あとで もういちど するね");

    openTab(/めがね/);
    fireEvent.click(card(/まるめがね/));
    await wait(500);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    // 送れなかった「ぼうし」も、次の保存といっしょに送られた
    expect(putBodies(fetchMock).at(-1)).toEqual({ hat: "hat_safari", glasses: "glasses_round" });
  });

  it("puts back a slot the server did not accept, and keeps the rest", async () => {
    setLevel(5); // 画面では Lv.2: キラキラガールが着られる
    fetchMock.mockImplementationOnce(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body ?? "{}")).equipped;
      return new Response(
        JSON.stringify({ success: true, data: { reward: {}, equipped: { ...DEFAULT_EQUIPPED, ...sent, effect: "effect_none" }, stored: true, rejected: ["effect"] } }),
        { status: 200 },
      );
    });
    localStorage.setItem("kanoha_active_child_v1", CHILD); // 端末の表示を戻すのは、その子を開いているときだけ
    renderOpen();
    openTab(/コーデ/);
    fireEvent.click(card(/キラキラガール/)); // effect_sparkle(Lv.2)を含む
    await wait(500);

    expect(getEquippedAccessories().effect).toBe("effect_none");
    expect(getEquippedAccessories().accessory).toBe("acc_pin_star");
  });

  it("moves between the tabs with the arrow keys, and only the selected tab can be reached with Tab", () => {
    renderOpen();
    const tabs = screen.getAllByRole("tab");
    const selected = screen.getByRole("tab", { selected: true });
    expect(selected).toHaveTextContent("キャラ");
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([selected]);

    fireEvent.keyDown(selected, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("ふく");
    expect(document.activeElement).toBe(screen.getByRole("tab", { selected: true }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("コーデ");
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowLeft" }); // 先頭から 反対のはしへ
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("うごき");
  });

  it("ties the list to the selected tab (tabpanel)", () => {
    renderOpen();
    openTab(/ぼうし/);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", screen.getByRole("tab", { name: /ぼうし/ }).id);
    expect(screen.getByRole("tab", { name: /ぼうし/ })).toHaveAttribute("aria-controls", panel.id);
    expect(within(panel).getByRole("button", { name: /たんけんぼう/ })).toBeInTheDocument();
  });

  it("sends a waiting change when the closet goes away without pressing a button", async () => {
    const { unmount } = renderOpen();
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));
    unmount();
    await wait(0);
    expect(putBodies(fetchMock)).toEqual([{ hat: "hat_safari" }]);
  });

  it("sends a waiting change right away when the closet is closed", async () => {
    renderOpen();
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));
    fireEvent.click(screen.getByRole("button", { name: /できた/ }));
    await wait(0);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(putBodies(fetchMock)).toEqual([{ hat: "hat_safari" }]);
  });

  it("follows a sync that finishes while it is open, and never sends the slots it did not touch", async () => {
    renderOpen();
    openTab(/めがね/);

    // 開いている間に、サーバーとの同期が終わって 端末の着せかえが入れかわった
    act(() => saveEquippedAccessories({ ...DEFAULT_EQUIPPED, hat: "hat_safari", clothes: "clothes_school" }));
    fireEvent.click(card(/まるめがね/));
    await wait(500);

    expect(putBodies(fetchMock)).toEqual([{ glasses: "glasses_round" }]);
    expect(getEquippedAccessories()).toMatchObject({ hat: "hat_safari", clothes: "clothes_school", glasses: "glasses_round" });
  });

  it("does not remount the character on every change (no key tied to the whole set)", () => {
    const { container } = renderOpen();
    const stage = container.querySelector("[role='img'], [role='button'][aria-label]");
    openTab(/ぼうし/);
    fireEvent.click(card(/たんけんぼう/));
    expect(container.querySelector("[role='img'], [role='button'][aria-label]")).toBe(stage);
  });
});
