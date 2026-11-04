import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewPracticeCard } from "@/components/child/NewPracticeCard";

const CHILD = "11111111-1111-4111-8111-111111111111";

const item = (n: number, done = false) => ({
  problemId: `0000000${n}-0000-4000-8000-000000000000`,
  position: n - 1,
  done,
});

const setOf = (doneCount: number, overrides: Record<string, unknown> = {}) => ({
  status: "ready",
  batchId: "batch-1",
  seq: 1,
  remainingSets: 2,
  items: [1, 2, 3, 4, 5].map((n) => item(n, n <= doneCount)),
  ...overrides,
});

const reply = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify({ success: status < 400, data }), { status }));

const fetchMock = vi.fn();
const bodies = (): Record<string, unknown>[] => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("NewPracticeCard(ホームの「あたらしい もんだい」)", () => {
  it("開いたとき 今日のセットを 1 回だけ取りにいく(more なし)。待つあいだは じゅんびちゅう", async () => {
    fetchMock.mockReturnValue(reply(setOf(0)));
    render(<NewPracticeCard childId={CHILD} subject="math" />);
    expect(screen.getByRole("status")).toHaveTextContent("じゅんびちゅう");
    // 見出しは待っているあいだも出ているので、返事が届いた(「はじめる」が出た)あとで 回数を数える
    await screen.findByRole("link", { name: /はじめる/ });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/practice/new-set");
    expect(bodies()[0]).toEqual({ childId: CHILD, subject: "math", more: false });
  });

  it("まだ解いていないとき: 「はじめる」が 1 問目へ(セットの手がかり付き)。進みは 0 / 5", async () => {
    fetchMock.mockReturnValue(reply(setOf(0)));
    render(<NewPracticeCard childId={CHILD} subject="math" />);
    const link = await screen.findByRole("link", { name: /はじめる/ });
    expect(link).toHaveAttribute("href", `/child/problem/00000001-0000-4000-8000-000000000000?childId=${CHILD}&batch=batch-1`);
    expect(screen.getByText("いまの きみに ぴったりの 5もん")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0 / 5 もん できたよ")).toBeInTheDocument();
  });

  it("途中のとき: 「つづきから」が 最初の まだ解いていない問題へ", async () => {
    fetchMock.mockReturnValue(reply(setOf(2)));
    render(<NewPracticeCard childId={CHILD} subject="english" />);
    const link = await screen.findByRole("link", { name: /つづきから/ });
    expect(link).toHaveAttribute("href", `/child/problem/00000003-0000-4000-8000-000000000000?childId=${CHILD}&batch=batch-1`);
    expect(screen.getByText("2 / 5 もん できたよ")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("5 問ぜんぶできて 次のセットを作れるとき: 「もう 1セット」で次を取りにいき、そのセットを出す", async () => {
    fetchMock.mockReturnValueOnce(reply(setOf(5)));
    render(<NewPracticeCard childId={CHILD} subject="math" />);
    const more = await screen.findByRole("button", { name: /もう 1セット/ });
    expect(screen.getByText("ぜんぶ できたね！")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /はじめる|つづきから/ })).toBeNull();

    fetchMock.mockReturnValueOnce(reply(setOf(0, { batchId: "batch-2", seq: 2, remainingSets: 1 })));
    await userEvent.click(more);
    const link = await screen.findByRole("link", { name: /はじめる/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("batch=batch-2"));
    expect(bodies()[1]).toEqual({ childId: CHILD, subject: "math", more: true });
  });

  it("ぜんぶ できて もう作れないとき(のこり 0): 「また あした」だけ", async () => {
    fetchMock.mockReturnValue(reply(setOf(5, { remainingSets: 0 })));
    render(<NewPracticeCard childId={CHILD} subject="math" />);
    expect(await screen.findByText("きょうの ぶんは ぜんぶ できたね！ また あした！")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /もう 1セット/ })).toBeNull();
  });

  it("次のセットが 上限で作れなかったとき(limit)も 「また あした」", async () => {
    fetchMock.mockReturnValueOnce(reply(setOf(5)));
    render(<NewPracticeCard childId={CHILD} subject="math" />);
    const more = await screen.findByRole("button", { name: /もう 1セット/ });
    fetchMock.mockReturnValueOnce(reply({ status: "limit", remainingSets: 0 }));
    await userEvent.click(more);
    expect(await screen.findByText("きょうの ぶんは ぜんぶ できたね！ また あした！")).toBeInTheDocument();
  });

  it.each([[401], [403], [404]])("使えないとき(%i): カードを出さない", async (status) => {
    fetchMock.mockReturnValue(reply(null, status));
    const { container } = render(<NewPracticeCard childId={CHILD} subject="math" />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it("出せる問題がないとき(empty): カードを出さない", async () => {
    fetchMock.mockReturnValue(reply({ status: "empty", remainingSets: 0 }));
    const { container } = render(<NewPracticeCard childId={CHILD} subject="math" />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it("失敗したとき: 「うまく ひらけなかったよ」と 「もういちど ためす」。押すと取りなおす", async () => {
    fetchMock.mockReturnValueOnce(reply(null, 500));
    render(<NewPracticeCard childId={CHILD} subject="math" />);
    expect(await screen.findByText("うまく ひらけなかったよ。")).toBeInTheDocument();
    fetchMock.mockReturnValueOnce(reply(setOf(0)));
    await userEvent.click(screen.getByRole("button", { name: "もういちど ためす" }));
    expect(await screen.findByRole("link", { name: /はじめる/ })).toBeInTheDocument();
  });

  it("通信できなかったとき(例外)も 失敗として出す", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    render(<NewPracticeCard childId={CHILD} subject="math" />);
    expect(await screen.findByText("うまく ひらけなかったよ。")).toBeInTheDocument();
  });

  it("教科が変わったら その教科のセットを取りなおす。古い返事は使わない", async () => {
    let resolveMath: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveMath = resolve)));
    const { rerender } = render(<NewPracticeCard childId={CHILD} subject="math" />);
    fetchMock.mockReturnValueOnce(reply(setOf(0, { batchId: "english-batch" })));
    rerender(<NewPracticeCard childId={CHILD} subject="english" />);
    expect(await screen.findByRole("link", { name: /はじめる/ })).toHaveAttribute("href", expect.stringContaining("batch=english-batch"));
    await act(async () => resolveMath(new Response(JSON.stringify({ success: true, data: setOf(0, { batchId: "math-batch" }) }), { status: 200 })));
    expect(screen.getByRole("link", { name: /はじめる/ })).toHaveAttribute("href", expect.stringContaining("batch=english-batch"));
    expect(bodies().map((body) => body.subject)).toEqual(["math", "english"]);
  });
});
