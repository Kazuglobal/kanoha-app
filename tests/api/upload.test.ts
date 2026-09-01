import { describe, expect, it } from "vitest";
import { validateImage } from "@/lib/utils/upload";

describe("validateImage", () => {
  it("accepts a PNG matching its declared content type", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])],
      "page.png",
      { type: "image/png" },
    );
    await expect(validateImage(file)).resolves.toBe("png");
  });

  it("rejects spoofed image content", async () => {
    const file = new File(["not an image"], "page.png", { type: "image/png" });
    await expect(validateImage(file)).resolves.toBeNull();
  });
});
