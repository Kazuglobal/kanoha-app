import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/ai/stt/route";

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
});
