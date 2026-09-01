"use client";

import { type FormEvent, useState } from "react";
import styles from "@/components/kanoha.module.css";

const CHILD_HOME = "/child/home";

/**
 * 親 PIN の登録と子どもモードの開始(A1)。
 * PIN は 4 桁。サーバーはハッシュだけを保存し、この画面に PIN の有無以外は返さない。
 */
export function PinSettings({ hasPin: initialHasPin }: { hasPin: boolean }) {
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function show(text: string, error: boolean) {
    setMessage(text);
    setIsError(error);
    setPending(false);
  }

  async function savePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || pin.length !== 4) return;
    setPending(true);
    const response = await fetch("/api/parent/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) {
      show("PINを保存できませんでした。", true);
      return;
    }
    setHasPin(true);
    setPin("");
    show("PINを保存しました。", false);
  }

  async function startChildMode() {
    if (pending) return;
    setPending(true);
    const response = await fetch("/api/child-mode", { method: "POST" }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) {
      show(response?.status === 409 ? "先に親PINを登録してください。" : "子どもモードを開始できませんでした。", true);
      return;
    }
    window.location.assign(CHILD_HOME);
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>子どもモードと親PIN</h2>
      <p className={styles.tiny}>
        {hasPin
          ? "PINは登録済みです。子どもモード中は、このPINで保護者用画面に戻れます。"
          : "子どもモードを使うには、4桁の親PINを先に登録してください。"}
      </p>
      <form onSubmit={(event) => void savePin(event)}>
        <label className={styles.field}>{hasPin ? "PINを変更" : "親PIN(4桁)"}
          <input
            autoComplete="off"
            disabled={pending}
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            placeholder="0000"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <div className={styles.hintActions}>
          <button className={styles.primaryButton} disabled={pending || pin.length !== 4} type="submit">
            {hasPin ? "PINを変更" : "PINを登録"}
          </button>
          <button className={styles.secondaryButton} disabled={pending || !hasPin} type="button" onClick={() => void startChildMode()}>
            子どもモードをはじめる
          </button>
        </div>
      </form>
      {message ? (
        <p aria-live="polite" className={isError ? styles.feedbackWrong : styles.feedback} role={isError ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
