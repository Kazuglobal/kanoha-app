"use client";

import { Home, Lock } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { RewardMeter } from "@/components/child/RewardMeter";
import { SoundToggleButton } from "@/components/child/SoundToggleButton";
import { syncRewardsFromServer } from "@/lib/rewards/rewardSync";

const PARENT_HOME = "/parent/dashboard";

/**
 * 子ども画面の共通ヘッダー。親画面へのリンクは置かない(A1)。
 * 親は「おうちのかた」ボタンから PIN を入れて子どもモードを解除する(POST /api/parent/pin/verify)。
 * childId があれば、その子のごほうび・着せかえを DB から読んで表示を合わせる。
 */
export function ChildHeader({ progress, childId }: { progress?: string; childId?: string }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (childId) void syncRewardsFromServer(childId);
  }, [childId]);

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

  // Esc で PIN ポップオーバーを閉じる(キーボード操作でも迷わない)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const progressPercent = (() => {
    if (!progress) return 0;
    const parts = progress.split("/").map((s) => parseFloat(s.trim()));
    return parts.length === 2 && parts[1] > 0
      ? Math.min(100, Math.round((parts[0] / parts[1]) * 100))
      : 100;
  })();

  return (
    <header className={styles.topbar}>
      <Link className={styles.brand} href="/child/home" aria-label="さゆき ホームへ">
        <span className={styles.brandMark}>さ</span>
        <span className={styles.brandText}>さゆき</span>
      </Link>
      {progress ? (
        <div className={styles.topProgress}>
          <div className={styles.gameProgressBarTrack} title={`進捗: ${progress}`}>
            <div className={styles.gameProgressBarFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <span className={styles.topProgressText}>{progress}</span>
        </div>
      ) : null}
      <div className={styles.topActions}>
        <RewardMeter />
        <SoundToggleButton />
        <Link
          className={`${styles.ghostButton} ${styles.topIconButton} ${styles.topHomeButton}`}
          href="/child/home"
          aria-label="ホーム"
        >
          <Home size={20} />
        </Link>
        <button
          aria-expanded={open}
          aria-label="おうちのかた"
          className={`${styles.ghostButton} ${styles.topIconButton}`}
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <Lock size={20} />
        </button>
      </div>
      {open ? (
        <form
          aria-label="おうちのかた用 PIN"
          className={styles.pinPopover}
          onSubmit={(event) => void unlock(event)}
        >
          <input
            aria-label="PIN"
            autoComplete="off"
            autoFocus
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
          {message ? (
            <span className={styles.tiny} role="alert">
              {message}
            </span>
          ) : null}
        </form>
      ) : null}
    </header>
  );
}

