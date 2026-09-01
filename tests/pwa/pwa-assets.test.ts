import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PWA assets", () => {
  it("provides an installable manifest with maskable icons", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));

    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/child/home");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any maskable" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any maskable" }),
    ]));
    expect(existsSync("public/icon-192.png")).toBe(true);
    expect(existsSync("public/icon-512.png")).toBe(true);
  });

  it("keeps API and authenticated pages out of the offline cache", () => {
    const worker = readFileSync("public/sw.js", "utf8");

    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('caches.match("/offline")');
    expect(worker).not.toContain('cache.put(request');
  });

  it("serves the service worker with no-cache security headers", () => {
    const config = readFileSync("next.config.ts", "utf8");

    expect(config).toContain('source: "/sw.js"');
    expect(config).toContain('"Cache-Control", value: "no-cache, no-store, must-revalidate"');
    expect(config).toContain('"Content-Security-Policy", value: "default-src \'self\'; script-src \'self\'"');
  });
});
