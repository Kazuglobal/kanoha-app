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

  it("completely clips out original hands, original shoes, and original headgear when replacing them", () => {
    const accessories: EquippedAccessories = {
      clothes: "clothes_wizard",
      hairstyle: "hair_twintail",
      hair_color: "hair_color_pink",
      shoes: "shoes_sneaker",
      shoes_color: "shoes_color_white",
      hat: "hat_crown",
      glasses: "glasses_round",
      gloves: "gloves_mitten",
      accessory: "acc_pin_star",
    };

    const { container } = render(
      <KanohaCharacter mood="happy" accessories={accessories} />
    );

    const images = Array.from(container.querySelectorAll("img"));
    const baseImg = images.find((img) => img.getAttribute("src")?.includes("wizard"))!;
    const glovesImg = images.find((img) => img.getAttribute("src")?.includes("mittens"))!;
    const shoesImg = images.find((img) =>
      img.getAttribute("src")?.includes("happy") &&
      img.style.clipPath.includes("78%")
    )!;

    // ベース衣装は頭頂部(15.5%)・素手(36%/56%)・元の靴(78%/85.5%)がすべてクリップ除去されていること
    expect(baseImg.style.clipPath).toContain("15.5%");
    expect(baseImg.style.clipPath).toContain("36%");
    expect(baseImg.style.clipPath).toContain("56%");
    expect(baseImg.style.clipPath).toContain("78%");
    expect(baseImg.style.clipPath).toContain("85.5%");

    // 手袋オーバーレイは両手領域のみを切り出し、元のくまパーカー胴体(28%..70%全域)を含まないこと
    expect(glovesImg.style.clipPath).toContain("18% 36%");
    expect(glovesImg.style.clipPath).toContain("69.5% 56%");
    expect(glovesImg.style.clipPath).not.toContain("12% 28%");

    // 靴オーバーレイはスニーカー(happy)の膝下領域を描画していること
    expect(shoesImg).toBeTruthy();
  });

  it("renders newly selectable characters with their dedicated generated dress-up sprites", () => {
    const newCharIds = ["char_fuwari", "char_hinata", "char_ren", "char_riku", "char_mia"] as const;
    for (const charId of newCharIds) {
      const sprite = getKanohaSprite("happy", {
        character: charId,
        clothes: "clothes_wizard",
        hat: "hat_none",
        glasses: "glasses_none",
        gloves: "gloves_none",
      });
      expect(sprite).toContain("-wizard.png");
    }
  });
});
