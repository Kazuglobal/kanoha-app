const SLACK_TIMEOUT_MS = 5_000;
const MAX_MESSAGE_LENGTH = 3_000;

export async function sendSlackReport(webhookUrl: string, message: string) {
  const url = new URL(webhookUrl);
  if (url.protocol !== "https:" || url.hostname !== "hooks.slack.com") {
    throw new Error("Invalid Slack webhook");
  }

  const text = message.slice(0, MAX_MESSAGE_LENGTH);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
        redirect: "error",
      });
      if (response.ok) return;
    } catch {
      // Retry once without exposing the webhook or report content.
    }
  }
  throw new Error("Slack delivery failed");
}
