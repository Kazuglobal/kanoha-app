import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("security headers", () => {
  it("only lets the browser connect to our own origin (all AI/DB access goes through the server)", async () => {
    const rules = await nextConfig.headers!();
    const csp = rules
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === "Content-Security-Policy")!.value;
    const connectSrc = csp.split("; ").find((directive) => directive.startsWith("connect-src"));
    expect(connectSrc).toBe("connect-src 'self'");
  });
});
