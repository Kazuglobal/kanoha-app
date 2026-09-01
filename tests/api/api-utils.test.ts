import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJson } from "@/lib/utils/api";

describe("parseJson", () => {
  it("rejects malformed JSON without throwing", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: "{",
    });
    const result = await parseJson(request, z.object({ childId: z.string().uuid() }));
    expect(result.success).toBe(false);
  });
});
