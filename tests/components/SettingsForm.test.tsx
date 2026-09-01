import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/components/parent/SettingsForm";

const childId = "11111111-1111-4111-8111-111111111111";

describe("SettingsForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and saves settings for the selected child", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [{ id: childId, nickname: "かのは" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          child_id: childId,
          explanation_level: "standard",
          daily_limit_minutes: 20,
          enable_audio: false,
          enable_voice_answer: true,
          enable_slack: false,
          slack_configured: false,
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { child_id: childId },
      }), { status: 200 }));
    const user = userEvent.setup();

    render(<SettingsForm />);

    expect(await screen.findByRole("option", { name: "かのは" })).toBeInTheDocument();
    expect(screen.getByLabelText("説明のやさしさ")).toHaveValue("standard");
    expect(screen.getByLabelText("1日の学習時間")).toHaveValue("20");
    expect(screen.getByLabelText("音声読み上げ")).not.toBeChecked();

    await user.selectOptions(screen.getByLabelText("1日の学習時間"), "10");
    await user.click(screen.getByRole("button", { name: "設定を保存" }));

    expect(await screen.findByRole("status")).toHaveTextContent("保存しました");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/settings/${childId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          explanationLevel: "standard",
          dailyLimitMinutes: 10,
          enableAudio: false,
          enableVoiceAnswer: true,
        }),
      }),
    );
  });

  it("configures Slack without including the webhook in regular settings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [{ id: childId, nickname: "かのは" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          child_id: childId,
          explanation_level: "easy",
          daily_limit_minutes: 15,
          enable_audio: true,
          enable_voice_answer: true,
          enable_slack: false,
          slack_configured: false,
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { configured: true, enabled: true },
      }), { status: 200 }));
    const user = userEvent.setup();
    render(<SettingsForm />);

    await screen.findByRole("option", { name: "かのは" });
    await user.type(
      screen.getByLabelText("Slack Webhook URL"),
      "https://hooks.slack.com/services/T000/B000/secret",
    );
    await user.click(screen.getByRole("button", { name: "Slack通知を設定" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Slack通知を設定しました");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/settings/${childId}/slack`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ webhookUrl: "https://hooks.slack.com/services/T000/B000/secret" }),
      }),
    );
  });
});
