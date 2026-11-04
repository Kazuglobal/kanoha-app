import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CharacterExtras } from "@/components/child/CharacterExtras";
import { KanohaCharacter } from "@/components/child/KanohaCharacter";
import { effectSpec, isOnFace, petIcon, resolveMotion } from "@/components/child/characterExtrasData";
import { ACCESSORY_CATALOG, DEFAULT_EQUIPPED } from "@/lib/rewards/catalog";

const EFFECT_IDS = ACCESSORY_CATALOG.filter((item) => item.category === "effect" && item.id !== "effect_none").map((item) => item.id);
const PET_IDS = ACCESSORY_CATALOG.filter((item) => item.category === "pet" && item.id !== "pet_none").map((item) => item.id);
const MOTION_IDS = ACCESSORY_CATALOG.filter((item) => item.category === "motion").map((item) => item.id);

describe("characterExtrasData", () => {
  it("every effect and pet in the catalog can be drawn (no item is left without a look)", () => {
    for (const id of EFFECT_IDS) expect(effectSpec(id), id).not.toBeNull();
    for (const id of PET_IDS) expect(petIcon(id), id).toBeTruthy();
  });

  it("draws nothing for the plain defaults and for unknown ids", () => {
    expect(effectSpec("effect_none")).toBeNull();
    expect(effectSpec(undefined)).toBeNull();
    expect(effectSpec("effect_unknown")).toBeNull();
    expect(petIcon("pet_none")).toBeNull();
    expect(petIcon(undefined)).toBeNull();
    expect(petIcon("pet_unknown")).toBeNull();
  });

  it("maps every motion item to a motion, falling back to calm, and keeps study time calm", () => {
    for (const id of MOTION_IDS) expect(resolveMotion(id, "full"), id).toBe(id.replace("motion_", ""));
    expect(resolveMotion(undefined, "full")).toBe("calm");
    expect(resolveMotion("motion_unknown", "full")).toBe("calm");
    expect(resolveMotion("motion_spin", "subtle")).toBe("calm");
  });

  it("lays particles out the same way every time (server and browser must draw the same thing)", () => {
    for (const id of EFFECT_IDS) expect(effectSpec(id)).toEqual(effectSpec(id));
  });
});

describe("CharacterExtras", () => {
  it("renders nothing when there is no effect and no pet", () => {
    const { container } = render(<CharacterExtras effect="effect_none" pet="pet_none" intensity="full" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("draws every effect as a decorative layer that cannot be tapped", () => {
    for (const id of EFFECT_IDS) {
      const { container, unmount } = render(<CharacterExtras effect={id} pet="pet_none" intensity="full" />);
      const layer = container.querySelector(`[data-effect="${id.replace("effect_", "")}"]`);
      expect(layer, id).toBeTruthy();
      expect(layer?.getAttribute("aria-hidden")).toBe("true");
      expect(layer?.childElementCount, id).toBeGreaterThan(0);
      unmount();
    }
  });

  it("uses the item's own emoji for glyph effects", () => {
    const { container } = render(<CharacterExtras effect="effect_hearts" pet="pet_none" intensity="full" />);
    expect(container.querySelector("[data-effect='hearts'] text")?.textContent).toBe("💗");
  });

  it("shows fewer particles while studying", () => {
    const full = render(<CharacterExtras effect="effect_snow" pet="pet_none" intensity="full" />);
    const fullCount = full.container.querySelectorAll("[data-effect='snow'] text").length;
    full.unmount();
    const subtle = render(<CharacterExtras effect="effect_snow" pet="pet_none" intensity="subtle" />);
    const subtleCount = subtle.container.querySelectorAll("[data-effect='snow'] text").length;
    expect(subtleCount).toBeGreaterThan(0);
    expect(subtleCount).toBeLessThan(fullCount);
  });

  it("marks the particles that sit on the face (they are hidden when motion is reduced), and only those", () => {
    const { container } = render(<CharacterExtras effect="effect_snow" pet="pet_none" intensity="full" />);
    const texts = [...container.querySelectorAll("[data-effect='snow'] text")];
    const onFace = texts.filter((node) => isOnFace(Number(node.getAttribute("x")), Number(node.getAttribute("y"))));
    expect(onFace.length).toBeGreaterThan(0);
    expect(onFace.length).toBeLessThan(texts.length);
    for (const node of texts) expect(node.getAttribute("class")?.includes("particleFace"), node.outerHTML).toBe(onFace.includes(node));
  });

  it("puts the pet next to the character with the item's emoji", () => {
    const { container } = render(<CharacterExtras effect="effect_none" pet="pet_dragon" intensity="full" />);
    const pet = container.querySelector("[data-pet='pet_dragon']");
    expect(pet?.textContent).toBe("🐲");
    expect(pet?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("KanohaCharacter with motion, effect and pet", () => {
  const dressed = { ...DEFAULT_EQUIPPED, motion: "motion_dance", effect: "effect_hearts", pet: "pet_cat" };

  it("shows nothing extra for the default look", () => {
    const { container } = render(<KanohaCharacter mood="happy" accessories={DEFAULT_EQUIPPED} />);
    expect(container.querySelector("[data-effect]")).toBeNull();
    expect(container.querySelector("[data-pet]")).toBeNull();
    expect(container.querySelector("[data-motion]")?.getAttribute("data-motion")).toBe("calm");
  });

  it("does not add pictures: effects and pets are drawn, not loaded", () => {
    const plain = render(<KanohaCharacter mood="happy" accessories={DEFAULT_EQUIPPED} />);
    const before = plain.container.querySelectorAll("img").length;
    plain.unmount();
    const withExtras = render(<KanohaCharacter mood="happy" accessories={dressed} />);
    expect(withExtras.container.querySelectorAll("img").length).toBe(before);
  });

  it("applies the chosen motion, effect and pet for Kanoha", () => {
    const { container } = render(<KanohaCharacter mood="happy" accessories={dressed} />);
    expect(container.querySelector("[data-motion]")?.getAttribute("data-motion")).toBe("dance");
    expect(container.querySelector("[data-effect='hearts']")).toBeTruthy();
    expect(container.querySelector("[data-pet='pet_cat']")).toBeTruthy();
  });

  it("applies them for the other characters too", () => {
    const { container } = render(<KanohaCharacter mood="happy" accessories={{ ...dressed, character: "char_fuwari" }} />);
    expect(container.querySelector("[data-motion]")?.getAttribute("data-motion")).toBe("dance");
    expect(container.querySelector("[data-effect='hearts']")).toBeTruthy();
    expect(container.querySelector("[data-pet='pet_cat']")).toBeTruthy();
  });

  it("puts the matching style class on the body for every motion (not only the data attribute)", () => {
    const classOf = (motion: string) => {
      const { container, unmount } = render(<KanohaCharacter mood="happy" accessories={{ ...DEFAULT_EQUIPPED, motion }} />);
      const className = container.querySelector("[data-motion]")?.className ?? "";
      unmount();
      return className;
    };
    for (const name of ["bouncy", "float", "sway", "dance", "spin"]) {
      expect(classOf(`motion_${name}`), name).toContain(`motion${name[0].toUpperCase()}${name.slice(1)}`);
    }
    // しずか は 基本の ふわふわ のまま(うごきのクラスを足さない)
    expect(classOf("motion_calm")).not.toMatch(/motion[A-Z]/);
  });

  it("keeps the motion calm while studying", () => {
    const { container } = render(<KanohaCharacter mood="happy" accessories={dressed} intensity="subtle" />);
    expect(container.querySelector("[data-motion]")?.getAttribute("data-motion")).toBe("calm");
    expect(container.querySelector("[data-effect='hearts']")?.getAttribute("data-intensity")).toBe("subtle");
  });

  it("keeps the character as a single labelled image (the extras are decoration)", () => {
    const { container } = render(<KanohaCharacter mood="happy" accessories={dressed} />);
    const roots = container.querySelectorAll("[role='img']");
    expect(roots).toHaveLength(1);
    expect(roots[0].getAttribute("aria-label")).toContain("かのは");
  });
});
