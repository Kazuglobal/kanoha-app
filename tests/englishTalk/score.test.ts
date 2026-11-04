import { describe, expect, it } from "vitest";
import { talkStars, type TalkOutcome } from "@/lib/englishTalk/score";

const stars = (...outcomes: TalkOutcome[]) => talkStars(outcomes);

describe("talkStars", () => {
  it("全部ヘルプなしでできたら★3", () => {
    expect(stars("clean", "clean", "clean", "clean")).toBe(3);
  });

  it("ヘルプ(日本語・4択)を使ったターンは点が下がるが、おてほんを見なければ高い点数なら★3のまま", () => {
    expect(stars("clean", "clean", "clean", "help")).toBe(3);
    expect(stars("clean", "clean", "help", "help")).toBe(3);
  });

  it("全部ヘルプを使ったら★2", () => {
    expect(stars("help", "help", "help", "help")).toBe(2);
  });

  it("おてほんを見たターンがひとつでもあれば、★3にはならない", () => {
    expect(stars("clean", "clean", "clean", "teach")).toBe(2);
    expect(stars("clean", "clean", "teach", "teach")).toBe(2);
  });

  it("ほとんどおてほんを見たら★1", () => {
    expect(stars("clean", "teach", "teach", "teach")).toBe(1);
    expect(stars("teach", "teach", "teach", "teach")).toBe(1);
  });

  it("ターンがないときは★1(0 で割らない)", () => {
    expect(stars()).toBe(1);
  });
});
