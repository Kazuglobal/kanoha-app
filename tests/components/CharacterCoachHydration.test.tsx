import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { CharacterCoach } from "@/components/child/CharacterCoach";
import { getEquippedAccessories, saveEquippedAccessories } from "@/lib/rewards/characterGrowthStore";

describe("CharacterCoach first render", () => {
  beforeEach(() => localStorage.clear());

  it("does not depend on localStorage, so it matches the server-rendered markup (no hydration mismatch)", () => {
    const withoutStorage = renderToString(<CharacterCoach message="こんにちは" />);

    saveEquippedAccessories({ ...getEquippedAccessories(), hat: "hat_safari", glasses: "glasses_round" });
    const withStorage = renderToString(<CharacterCoach message="こんにちは" />);

    expect(withStorage).toBe(withoutStorage);
  });
});
