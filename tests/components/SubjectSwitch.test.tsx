import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubjectSwitch } from "@/components/child/SubjectSwitch";

describe("SubjectSwitch component", () => {
  it("renders both math and japanese options", () => {
    render(<SubjectSwitch currentSubject="math" childId="child-1" />);

    const mathLink = screen.getByRole("link", { name: /さんすう/ });
    const japaneseLink = screen.getByRole("link", { name: /こくご/ });

    expect(mathLink).toBeDefined();
    expect(japaneseLink).toBeDefined();
    expect(mathLink.getAttribute("href")).toContain("subject=math");
    expect(japaneseLink.getAttribute("href")).toContain("subject=japanese");
    expect(mathLink.getAttribute("href")).toContain("childId=child-1");
  });

  it("marks math as active when currentSubject is math", () => {
    render(<SubjectSwitch currentSubject="math" />);

    const mathLink = screen.getByRole("link", { name: /さんすう/ });
    const japaneseLink = screen.getByRole("link", { name: /こくご/ });

    expect(mathLink.getAttribute("aria-current")).toBe("page");
    expect(japaneseLink.getAttribute("aria-current")).toBeNull();
  });

  it("marks japanese as active when currentSubject is japanese", () => {
    render(<SubjectSwitch currentSubject="japanese" />);

    const mathLink = screen.getByRole("link", { name: /さんすう/ });
    const japaneseLink = screen.getByRole("link", { name: /こくご/ });

    expect(japaneseLink.getAttribute("aria-current")).toBe("page");
    expect(mathLink.getAttribute("aria-current")).toBeNull();
  });
});
