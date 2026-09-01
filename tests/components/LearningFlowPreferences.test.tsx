import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

describe("LearningFlow preferences", () => {
  it("hides audio controls disabled by the parent", () => {
    render(<LearningFlow preferences={{ enableAudio: false, enableVoiceAnswer: false, readingMode: "kanji_with_ruby" }} />);

    expect(screen.queryByRole("button", { name: /よみあげる/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /こえで こたえる/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("こたえ")).toBeInTheDocument();
  });
});
