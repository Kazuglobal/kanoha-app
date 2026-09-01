import { describe, expect, it } from "vitest";
import { slackWebhookInput } from "@/lib/slack/schemas";

describe("slackWebhookInput", () => {
  it("accepts Slack incoming webhook URLs", () => {
    expect(slackWebhookInput.safeParse({
      webhookUrl: "https://hooks.slack.com/services/T000/B000/secret",
    }).success).toBe(true);
  });

  it("rejects non-Slack and lookalike destinations", () => {
    expect(slackWebhookInput.safeParse({
      webhookUrl: "https://hooks.slack.com.example.com/services/T/B/C",
    }).success).toBe(false);
  });
});
