import { describe, expect, it } from "vitest";
import { createBoundedCache } from "@/lib/audio/ttsCache";

describe("createBoundedCache", () => {
  it("never holds more than maxEntries and drops the least recently used first", () => {
    const cache = createBoundedCache<string>(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.get("a"); // a を使ったので b が一番古くなる
    cache.set("d", "4");

    expect(cache.size).toBe(3);
    expect(cache.has("b")).toBe(false);
    expect([cache.get("a"), cache.get("c"), cache.get("d")]).toEqual(["1", "3", "4"]);
  });

  it("overwriting a key does not grow the cache", () => {
    const cache = createBoundedCache<string>(2);
    cache.set("a", "1");
    cache.set("a", "2");
    cache.set("b", "3");
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe("2");
  });

  it("returns undefined for unknown keys", () => {
    expect(createBoundedCache<string>(2).get("x")).toBeUndefined();
  });
});
