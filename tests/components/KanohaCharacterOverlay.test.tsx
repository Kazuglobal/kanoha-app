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

    // ベース衣装は頭頂部(21.2%)・素手(36%/56%)・元の靴(78%/85.5%)がすべてクリップ除去されていること
    expect(baseImg.style.clipPath).toContain("21.2%");
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

    // 帽子オーバーレイは茶髪おだんごを含まないクリーン単体スプライト(kanoha-hat-crown.png)を使用していること
    const crownImg = images.find((img) => img.getAttribute("src")?.includes("kanoha-hat-crown.png"));
    expect(crownImg).toBeTruthy();
  });

  it("renders newly selectable characters with their dedicated generated dress-up sprites and per-variant hair layers", () => {
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

      const { container } = render(
        <KanohaCharacter
          mood="happy"
          accessories={{
            character: charId,
            clothes: "clothes_wizard",
            hair_color: "hair_color_pink",
            hat: "hat_none",
            glasses: "glasses_none",
            gloves: "gloves_none",
          }}
        />
      );
      const imgs = Array.from(container.querySelectorAll("img"));
      expect(imgs.some((img) => img.getAttribute("src")?.includes("-wizard-hair.png"))).toBe(true);
    }
  });

  it("does not render layer='back' svg for bun and bob, and uses BACK_HAIR_CLIP for twintail and pony", () => {
    // 1. hair_bun の時は layer="back" が描画されず、不要な前髪・頭頂部スプライトが背面に重複しない
    const { container: bunContainer } = render(
      <KanohaCharacter
        mood="happy"
        accessories={{
          character: "char_kanoha",
          clothes: "clothes_tshirt",
          hairstyle: "hair_bun",
          hair_color: "hair_color_brown",
          hat: "hat_none",
          glasses: "glasses_none",
          gloves: "gloves_none",
        }}
      />
    );
    const bunSvgs = Array.from(bunContainer.querySelectorAll("svg"));
    const bunHairSvgs = bunSvgs.filter((svg) => {
      const img = svg.querySelector("image");
      return img?.getAttribute("href")?.includes("hair-bun");
    });
    // 前面レイヤー(layer="front")の1つのみ描画されること（背面に重複しない）
    expect(bunHairSvgs.length).toBe(1);

    // 2. hair_twintail の時は layer="back" が BACK_HAIR_CLIP (y >= 35%) で顔・頭頂部を除外
    const { container: twinContainer } = render(
      <KanohaCharacter
        mood="happy"
        accessories={{
          character: "char_kanoha",
          clothes: "clothes_tshirt",
          hairstyle: "hair_twintail",
          hair_color: "hair_color_brown",
          hat: "hat_none",
          glasses: "glasses_none",
          gloves: "gloves_none",
        }}
      />
    );
    const twinSvgs = Array.from(twinContainer.querySelectorAll("svg"));
    const twinHairSvgs = twinSvgs.filter((svg) => {
      const img = svg.querySelector("image");
      return img?.getAttribute("href")?.includes("hair-twintail");
    });
    // 背面レイヤーと前面レイヤーの2つが存在
    expect(twinHairSvgs.length).toBe(2);
    const backSvg = twinHairSvgs.find((s) => (s as unknown as HTMLElement).style.zIndex === "1");
    expect((backSvg as unknown as HTMLElement)?.style.clipPath).toContain("35%");
  });

  it("prioritizes chosen clothes for new characters and does not let lingering hats or accessories hijack outfit", () => {
    // 新キャラで帽子に hat_safari が残っていても、服で clothes_school を選べば確実に school が選ばれる
    const sprite = getKanohaSprite("happy", {
      character: "char_fuwari",
      clothes: "clothes_school",
      hat: "hat_safari",
      glasses: "glasses_none",
      gloves: "gloves_none",
      accessory: "acc_wand",
    });
    expect(sprite).toContain("-school.png");

    // 服でいつもの服(clothes_tshirt)を選んだ場合、以前のアクセサリ(acc_wand, shoes_boots等)に邪魔されず base になる
    const baseSprite = getKanohaSprite("happy", {
      character: "char_ren",
      clothes: "clothes_tshirt",
      hat: "hat_safari",
      glasses: "glasses_none",
      gloves: "gloves_none",
      accessory: "acc_wand",
      shoes: "shoes_boots",
    });
    expect(baseSprite).toContain("-base.png");
  });

  it("renders all 10 diverse hairstyles on Fuwari (char_fuwari) and syncs with hair color", () => {
    const hairstyles = [
      { id: "hair_bun", expectedSprite: "fuwari-style-bun.png", layer: "front" },
      { id: "hair_bob", expectedSprite: "fuwari-style-bob.png", layer: "back" },
      { id: "hair_twintail", expectedSprite: "fuwari-style-twintail.png", layer: "back" },
      { id: "hair_pony", expectedSprite: "fuwari-style-pony.png", layer: "back" },
      { id: "hair_side_tail", expectedSprite: "fuwari-style-side-tail.png", layer: "back" },
      { id: "hair_long_wave", expectedSprite: "fuwari-style-long-wave.png", layer: "back" },
      { id: "hair_twin_bun", expectedSprite: "fuwari-style-twin-bun.png", layer: "back" },
      { id: "hair_braid", expectedSprite: "fuwari-style-braid.png", layer: "back" },
      { id: "hair_halfup", expectedSprite: "fuwari-style-halfup.png", layer: "back" },
    ] as const;

    for (const style of hairstyles) {
      const { container } = render(
        <KanohaCharacter
          mood="happy"
          accessories={{
            character: "char_fuwari",
            clothes: "clothes_tshirt",
            hairstyle: style.id,
            hair_color: "hair_color_pink",
            hat: "hat_none",
            glasses: "glasses_none",
            gloves: "gloves_none",
          }}
        />
      );

      const overlaySvg = container.querySelector(
        `svg[data-hairstyle="${style.id}"][data-layer="${style.layer}"]`
      ) as HTMLElement | null;
      expect(overlaySvg).toBeTruthy();

      const imageEl = overlaySvg?.querySelector("image");
      expect(imageEl?.getAttribute("href")).toContain(style.expectedSprite);
      // 髪色フィルター (hair_color_pink) が髪型エクステンションにも連動適用されること
      expect(overlaySvg?.style.filter).toContain("hue-rotate(295deg)");
    }

    // 標準の「ふわふわエアリー (hair_fluffy)」の時は追加の髪型オーバーレイを描画しない
    const { container: fluffyContainer } = render(
      <KanohaCharacter
        mood="happy"
        accessories={{
          character: "char_fuwari",
          clothes: "clothes_tshirt",
          hairstyle: "hair_fluffy",
          hat: "hat_none",
          glasses: "glasses_none",
          gloves: "gloves_none",
        }}
      />
    );
    expect(fluffyContainer.querySelector("svg[data-hairstyle]")).toBeNull();
  });

  it("renders hats, shoes, shoe colors, gloves, glasses, hair colors, and accessories on Fuwari and all new characters", () => {
    const { container } = render(
      <KanohaCharacter
        mood="happy"
        accessories={{
          character: "char_fuwari",
          clothes: "clothes_school",
          hairstyle: "hair_twintail",
          hair_color: "hair_color_brown",
          shoes: "shoes_magical",
          shoes_color: "shoes_color_pink",
          hat: "hat_crown",
          glasses: "glasses_star",
          gloves: "gloves_mitten",
          accessory: "acc_wand",
        }}
      />
    );

    const imgs = Array.from(container.querySelectorAll("img"));
    const srcs = imgs.map((img) => img.getAttribute("src") ?? "");

    // 1. ベース衣装: 制服 (fuwari-school.png)
    expect(srcs.some((s) => s.includes("fuwari-school.png"))).toBe(true);
    // 2. 帽子: おうかん (fuwari-hero.png の頭部スワップ + fuwari-hero-hair.png)
    expect(srcs.some((s) => s.includes("fuwari-hero.png"))).toBe(true);
    expect(srcs.some((s) => s.includes("fuwari-hero-hair.png"))).toBe(true);
    // 3. 靴: まほうのくつ (fuwari-wizard.png の足元スワップ) + いちごピンク色フィルター
    expect(srcs.some((s) => s.includes("fuwari-wizard.png"))).toBe(true);
    // 4. 手袋: ふわふわミトン (fuwari-hoodie.png の手元スワップ)
    expect(srcs.some((s) => s.includes("fuwari-hoodie.png"))).toBe(true);
    // 5. めがね: スターサングラス SVG
    expect(container.querySelector('svg[data-glasses="glasses_star"]')).toBeTruthy();
    // 6. 髪色: 銀髪キャラのふわりでも「茶髪 (hair_color_brown)」を選ぶとブラウンフィルターが適用される
    const hairOverlay = container.querySelector('svg[data-hairstyle="hair_twintail"]') as HTMLElement | null;
    expect(hairOverlay?.style.filter).toContain("hue-rotate(342deg)");
  });
});


