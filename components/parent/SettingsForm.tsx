"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";

interface ChildProfile {
  id: string;
  nickname: string;
}

interface SettingsState {
  explanationLevel: "very_easy" | "easy" | "standard";
  dailyLimitMinutes: number;
  enableAudio: boolean;
  enableVoiceAnswer: boolean;
}

const defaults: SettingsState = {
  explanationLevel: "easy",
  dailyLimitMinutes: 15,
  enableAudio: true,
  enableVoiceAnswer: true,
};

export function SettingsForm() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [settings, setSettings] = useState<SettingsState>(defaults);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [slackConfigured, setSlackConfigured] = useState(false);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const loadSettings = useCallback(async (selectedChildId: string) => {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/settings/${selectedChildId}`);
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setIsError(true);
      setMessage("設定を読み込めませんでした。");
      setPending(false);
      return;
    }
    setSettings({
      explanationLevel: body.data.explanation_level,
      dailyLimitMinutes: body.data.daily_limit_minutes,
      enableAudio: body.data.enable_audio,
      enableVoiceAnswer: body.data.enable_voice_answer,
    });
    setSlackConfigured(body.data.slack_configured);
    setSlackEnabled(body.data.enable_slack);
    setIsError(false);
    setPending(false);
  }, []);

  useEffect(() => {
    void (async () => {
      setPending(true);
      const response = await fetch("/api/children");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        setIsError(true);
        setMessage("設定を読み込めませんでした。");
        setPending(false);
        return;
      }
      setChildren(body.data);
      const firstChildId = body.data[0]?.id ?? "";
      setChildId(firstChildId);
      if (firstChildId) await loadSettings(firstChildId);
      else setPending(false);
    })();
  }, [loadSettings]);

  async function saveSettings() {
    if (!childId) return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/settings/${childId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      showError("設定を保存できませんでした。");
      return;
    }
    setIsError(false);
    setMessage("保存しました。");
    setPending(false);
  }

  async function configureSlack() {
    if (!childId || !webhookUrl) return;
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/settings/${childId}/slack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ webhookUrl }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      showError("Slack通知を設定できませんでした。");
      return;
    }
    setSlackConfigured(true);
    setSlackEnabled(true);
    setWebhookUrl("");
    setIsError(false);
    setMessage("Slack通知を設定しました。");
    setPending(false);
  }

  async function removeSlack() {
    if (!childId) return;
    setPending(true);
    const response = await fetch(`/api/settings/${childId}/slack`, { method: "DELETE" });
    if (!response.ok) {
      showError("Slack通知を解除できませんでした。");
      return;
    }
    setSlackConfigured(false);
    setSlackEnabled(false);
    setMessage("Slack通知を解除しました。");
    setPending(false);
  }

  function showError(error: string) {
    setIsError(true);
    setMessage(error);
    setPending(false);
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>学習の設定</h2>
      <label className={styles.field}>設定する子ども
        <select
          disabled={pending}
          value={childId}
          onChange={(event) => {
            setChildId(event.target.value);
            void loadSettings(event.target.value);
          }}
        >
          {children.length === 0 ? <option value="">プロフィールを先に作成してください</option> : null}
          {children.map((child) => <option key={child.id} value={child.id}>{child.nickname}</option>)}
        </select>
      </label>
      <label className={styles.field}>説明のやさしさ
        <select
          disabled={pending || !childId}
          value={settings.explanationLevel}
          onChange={(event) => setSettings({ ...settings, explanationLevel: event.target.value as SettingsState["explanationLevel"] })}
        >
          <option value="very_easy">とてもやさしい</option><option value="easy">やさしい</option><option value="standard">ふつう</option>
        </select>
      </label>
      <label className={styles.field}>1日の学習時間
        <select
          disabled={pending || !childId}
          value={settings.dailyLimitMinutes}
          onChange={(event) => setSettings({ ...settings, dailyLimitMinutes: Number(event.target.value) })}
        >
          <option value="10">10分</option><option value="15">15分</option><option value="20">20分</option>
        </select>
      </label>
      <label className={styles.switchRow}><span><strong>音声読み上げ</strong><br /><small className={styles.tiny}>子どもが押したときだけ再生</small></span><input aria-label="音声読み上げ" checked={settings.enableAudio} disabled={pending || !childId} type="checkbox" onChange={(event) => setSettings({ ...settings, enableAudio: event.target.checked })} /></label>
      <label className={styles.switchRow}><span><strong>音声回答</strong><br /><small className={styles.tiny}>対応端末で利用</small></span><input aria-label="音声回答" checked={settings.enableVoiceAnswer} disabled={pending || !childId} type="checkbox" onChange={(event) => setSettings({ ...settings, enableVoiceAnswer: event.target.checked })} /></label>
      <button className={styles.primaryButton} disabled={pending || !childId} type="button" onClick={() => void saveSettings()}>
        {pending ? "処理しています..." : "設定を保存"}
      </button>
      {message ? <p aria-live="polite" className={isError ? styles.feedbackWrong : styles.feedback} role={isError ? "alert" : "status"}>{message}</p> : null}
      <section style={{ marginTop: 26 }}>
        <h2 className={styles.sectionTitle} style={{ marginTop: 30 }}>Slack通知</h2>
        <p className={styles.tiny}>{slackConfigured ? "Webhook設定済みです。URLは画面に表示されません。" : "SlackのIncoming Webhook URLを暗号化して保存します。"}</p>
        <label className={styles.field}>Slack Webhook URL
          <input
            autoComplete="off"
            disabled={pending || !childId}
            placeholder="https://hooks.slack.com/services/..."
            type="password"
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
          />
        </label>
        <div className={styles.switchRow}><span><strong>日次レポートを送る</strong><br /><small className={styles.tiny}>{slackEnabled ? "有効" : "未設定"}</small></span><input aria-label="日次レポートを送る" checked={slackEnabled} disabled readOnly type="checkbox" /></div>
        <div className={styles.hintActions}>
          <button className={styles.primaryButton} disabled={pending || !childId || !webhookUrl} type="button" onClick={() => void configureSlack()}>
            Slack通知を設定
          </button>
          {slackConfigured ? <button className={styles.dangerButton} disabled={pending} type="button" onClick={() => void removeSlack()}>Slack通知を解除</button> : null}
        </div>
      </section>
    </section>
  );
}
