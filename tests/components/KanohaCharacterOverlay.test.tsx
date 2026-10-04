import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { KanohaCharacter, getKanohaSprite } from "@/components/child/KanohaCharacter";
import type { EquippedAccessories } from "@/lib/rewards/characterGrowthStore";

describe("KanohaCharacter multi-layer dress-up overlay", () => {
  it("maintains base clothes and overlays glasses and gloves simultaneously", () => {
    const accessories: EquippedAccessories = {
      clothes: "clothes_school",
      glasses: "glasses_round",
      gloves: "gloves_mitten",
      hat: "hat_none",
    };

    const { container } = render(
      <KanohaCharacter mood="happy" accessories={accessories} />
    );

    const images = container.querySelectorAll("img");
    // ベース衣装 + メガネ + 手袋 = 3レイヤー
    expect(images.length).toBe(3);

    const sources = Array.from(images).map((img) => img.getAttribute("src"));
    expect(sources.some((s) => s?.includes("school"))).toBe(true);
    expect(sources.some((s) => s?.includes("glasses-round"))).toBe(true);
    expect(sources.some((s) => s?.includes("mittens"))).toBe(true);
  });

  it("changing clothes keeps glasses layer intact", () => {
    const safariWithGlasses: EquippedAccessories = {
      clothes: "clothes_safari",
      glasses: "glasses_star",
      gloves: "gloves_none",
      hat: "hat_none",
    };

    const { container } = render(
      <KanohaCharacter mood="happy" accessories={safariWithGlasses} />
    );

    const images = container.querySelectorAll("img");
    // ベース衣装 (safari) + メガネ (star) = 2レイヤー
    expect(images.length).toBe(2);

    const sources = Array.from(images).map((img) => img.getAttribute("src"));
    expect(sources.some((s) => s?.includes("safari"))).toBe(true);
    expect(sources.some((s) => s?.includes("glasses-star"))).toBe(true);
  });

  it("getKanohaSprite returns correct base clothes sprite regardless of category", () => {
    const accessories: EquippedAccessories = {
      clothes: "clothes_hero",
      glasses: "glasses_round",
      gloves: "gloves_gold",
      hat: "hat_crown",
    };

    const sprite = getKanohaSprite("happy", accessories);
    expect(sprite).toContain("hero");
  });
});
