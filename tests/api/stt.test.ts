import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/stt/route";

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return { ...original, requireUser: vi.fn(async () => ({ db: {}, user: { id: "user-stt-1" } })) };
});

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: async () => true,
}));

describe("STT API validation", () => {
  it("rejects request when audioBase64 is missing or empty", async () => {
    const req = new Request("http://localhost/api/ai/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: "",
        sceneId: "park",
        turnId: "park-1",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Audio data is required");
  });

  it("rejects request when audioBase64 is too short to contain audio", async () => {
    const req = new Request("http://localhost/api/ai/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: "AAAA",
        sceneId: "park",
        turnId: "park-1",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects oversized audioBase64 payloads with 413", async () => {
    const req = new Request("http://localhost/api/ai/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: "A".repeat(2_000_001),
        sceneId: "park",
        turnId: "park-dog",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Audio data is too large");
  });
});
