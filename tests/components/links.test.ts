import { describe, expect, it } from "vitest";
import { homeHref, problemHref } from "@/components/child/links";

describe("problemHref: 問題画面へのリンク", () => {
  it("問題の id だけ", () => {
    expect(problemHref("p1")).toBe("/child/problem/p1");
  });

  it("子どもとセットの手がかりを この順で付ける", () => {
    expect(problemHref("p1", "c1")).toBe("/child/problem/p1?childId=c1");
    expect(problemHref("p1", "c1", "b1")).toBe("/child/problem/p1?childId=c1&batch=b1");
  });

  it("子どもがいないとき(デモ)は セットの手がかりも付けない", () => {
    expect(problemHref("p1", null, "b1")).toBe("/child/problem/p1");
    expect(problemHref("p1", undefined, "b1")).toBe("/child/problem/p1");
  });

  it("id や手がかりに特別な文字があっても、そのまま URL に入れずエンコードする", () => {
    expect(problemHref("a/b?c", "c d", "x&y")).toBe("/child/problem/a%2Fb%3Fc?childId=c%20d&batch=x%26y");
  });
});

describe("homeHref: ホームへのリンク(子どもと教科を引きつぐ)", () => {
  it("何も無ければ /child/home", () => {
    expect(homeHref()).toBe("/child/home");
  });

  it("子どもと教科", () => {
    expect(homeHref("c1")).toBe("/child/home?childId=c1");
    expect(homeHref("c1", "english")).toBe("/child/home?childId=c1&subject=english");
    expect(homeHref(undefined, "english")).toBe("/child/home?subject=english");
  });

  it("特別な文字はエンコードする", () => {
    expect(homeHref("c d")).toBe("/child/home?childId=c%20d");
  });
});
