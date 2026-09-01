import { z } from "zod";

export const slackWebhookInput = z.object({
  webhookUrl: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "hooks.slack.com" &&
      url.pathname.startsWith("/services/");
  }, "Invalid Slack webhook"),
});
