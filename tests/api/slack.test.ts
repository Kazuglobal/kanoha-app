import { afterEach, describe, expect, it, vi } from "vitest";
import { sendSlackReport } from "@/lib/slack/sendReport";

afterEach(() => vi.unstubAllGlobals());

describe("sendSlackReport", () => {
  it("rejects non-Slack destinations to prevent SSRF", async () => {
    await expect(sendSlackReport("https://example.com/hook", "hello")).rejects.toThrow(
      "Invalid Slack webhook",
    );
  });

  it("sends only to an allowlisted Slack webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await sendSlackReport("https://hooks.slack.com/services/a/b/c", "hello");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].hostname).toBe("hooks.slack.com");
  });
});
