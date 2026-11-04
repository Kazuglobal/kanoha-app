import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResultPage from "@/app/child/result/page";

vi.mock("@/lib/audio/coachSpeech", () => ({
  speakCoachVoice: vi.fn(async () => undefined),
  playPraiseVoice: vi.fn(async () => ""),
  playEncourageVoice: vi.fn(async () => ""),
  preloadCoachVoices: vi.fn(),
  stopCoachVoice: vi.fn(),
}));

const CHILD = "11111111-1111-4111-8111-111111111111";
const PROBLEM = "22222222-2222-4222-8222-222222222222";
const NEXT = "33333333-3333-4333-8333-333333333333";

const renderResult = async (params: Record<string, string>) => {
  const page = await ResultPage({ searchParams: Promise.resolve(params) });
  return render(page);
};

describe("結果ページ: 「あたらしい もんだい」のセットの手がかりと、子ども・教科を引きつぐ", () => {
  it("つぎの問題・もういちど のリンクに セットの手がかり(batch)を付ける", async () => {
    await renderResult({ score: "5", unit: "たし算", problemId: PROBLEM, childId: CHILD, nextProblemId: NEXT, batch: "batch-7", subject: "math" });
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/child/problem/${NEXT}?childId=${CHILD}&batch=batch-7`);
    expect(hrefs).toContain(`/child/problem/${PROBLEM}?childId=${CHILD}&batch=batch-7`);
  });

  it("手がかりが無いときは 従来どおり(batch を付けない)。子どもがいなければ batch も付けない", async () => {
    await renderResult({ score: "5", unit: "たし算", problemId: PROBLEM, childId: CHILD, nextProblemId: NEXT });
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toContain(`/child/problem/${NEXT}?childId=${CHILD}`);
  });

  it("ホームへ もどるリンクは 子どもと教科を引きつぐ(英語のセットから 算数のホームへ飛ばさない)", async () => {
    await renderResult({ score: "5", unit: "あいさつ", problemId: PROBLEM, childId: CHILD, subject: "english" });
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toContain(`/child/home?childId=${CHILD}&subject=english`);
  });

  it("知らない教科の値は 使わない", async () => {
    await renderResult({ score: "5", unit: "たし算", problemId: PROBLEM, childId: CHILD, subject: "<script>" });
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/child/home?childId=${CHILD}`);
    expect(hrefs.join("")).not.toContain("script");
  });
});
