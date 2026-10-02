"use client";

import { Home, Lock } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { RewardMeter } from "@/components/child/RewardMeter";
import { SoundToggleButton } from "@/components/child/SoundToggleButton";

const PARENT_HOME = "/parent/dashboard";

/**
 * 子ども画面の共通ヘッダー。親画面へのリンクは置かない(A1)。
 * 親は「おうちのかた」ボタンから PIN を入れて子どもモードを解除する(POST /api/parent/pin/verify)。
 */
export function ChildHeader({ progress }: { progress?: string }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    const response = await fetch("/api/parent/pin/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && body?.success) {
      window.location.assign(PARENT_HOME);
      return;
    }
    setPin("");
    setMessage(typeof body?.error === "string" ? body.error : "PINを確認できませんでした。");
    setPending(false);
  }

  return (
    <header className={styles.topbar}>
      <Link className={styles.brand} href="/child/home">
        <span className={styles.brandMark}>か</span>
        かのは
      </Link>
      <div className={styles.topActions}>
        <RewardMeter />
        <SoundToggleButton />
        {progress ? <strong>{progress}</strong> : null}
        <Link className={styles.ghostButton} href="/child/home" aria-label="ホーム">
          <Home size={20} />
        </Link>
        <button
          aria-expanded={open}
          aria-label="おうちのかた"
          className={styles.ghostButton}
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <Lock size={20} />
        </button>
        {open ? (
          <form aria-label="おうちのかた用 PIN" className={styles.answerRow} onSubmit={(event) => void unlock(event)}>
            <input
              aria-label="PIN"
              autoComplete="off"
              className={styles.answerInput}
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              placeholder="PIN"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <button className={styles.primaryButton} disabled={pending || pin.length !== 4} type="submit">
              かいじょ
            </button>
            {message ? <span className={styles.tiny} role="alert">{message}</span> : null}
          </form>
        ) : null}
      </div>
    </header>
  );
}
