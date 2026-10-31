import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SceneProgressBadge } from "@/components/child/englishTalk/SceneProgressBadge";
import { recordEnglishTalkSceneClear } from "@/lib/englishTalk/progressStore";

beforeEach(() => localStorage.clear());

describe("SceneProgressBadge: 場面の★", () => {
  it("記録がなければ何も出さない", () => {
    const { container } = render(<SceneProgressBadge sceneId="park" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("サーバーの記録(ログイン中の子)があれば その★を出す。この端末に記録がなくても", () => {
    render(<SceneProgressBadge sceneId="park" childId="c1" serverStars={2} />);
    expect(screen.getByLabelText("クリア ほし 2こ")).toBeInTheDocument();
  });

  it("端末の記録のほうが高いときは、高いほう(サーバーへ送れていないぶんを失わない)", () => {
    recordEnglishTalkSceneClear("park", 3, "c1");
    render(<SceneProgressBadge sceneId="park" childId="c1" serverStars={1} />);
    expect(screen.getByLabelText("クリア ほし 3こ")).toBeInTheDocument();
  });

  it("サーバーのほうが高いときは サーバーの★(古い端末の記録に引きずられない)", () => {
    recordEnglishTalkSceneClear("park", 1, "c1");
    render(<SceneProgressBadge sceneId="park" childId="c1" serverStars={3} />);
    expect(screen.getByLabelText("クリア ほし 3こ")).toBeInTheDocument();
  });

  it("デモ(サーバーの記録なし)は これまでどおり端末の記録", () => {
    recordEnglishTalkSceneClear("park", 2);
    render(<SceneProgressBadge sceneId="park" />);
    expect(screen.getByLabelText("クリア ほし 2こ")).toBeInTheDocument();
  });
});
