"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setIsError(false);

    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    };

    try {
      const supabase = createClient();
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

      if (result.error) {
        setIsError(true);
        setMessage(mode === "login"
          ? "メールアドレスまたはパスワードを確認してください。"
          : "登録できませんでした。入力内容を確認してください。");
        return;
      }

      if (mode === "signup" && !result.data.session) {
        setMessage("確認メールを送りました。メール内のリンクから登録を完了してください。");
        return;
      }

      const next = searchParams.get("next");
      const destination: Route = next && /^\/(?:parent|child)\//.test(next)
        ? next as Route
        : "/parent/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("現在ログインを利用できません。設定を確認してください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={`${styles.card} ${styles.formCard}`} onSubmit={handleSubmit}>
      <h1 className={styles.pageTitle}>{mode === "login" ? "保護者ログイン" : "保護者アカウント登録"}</h1>
      <p className={styles.tiny}>子どもモードの管理と学習レポートを確認できます。</p>
      <label className={styles.field}>
        メールアドレス
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label className={styles.field}>
        パスワード
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <button className={`${styles.primaryButton} ${styles.full}`} disabled={pending} type="submit">
        {pending ? "しばらくお待ちください" : mode === "login" ? "ログイン" : "登録する"}
      </button>
      {message ? (
        <p aria-live="polite" className={isError ? styles.feedbackWrong : styles.feedback} role={isError ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
      <button
        className={`${styles.secondaryButton} ${styles.full}`}
        disabled={pending}
        type="button"
        onClick={() => {
          setMode((current) => current === "login" ? "signup" : "login");
          setMessage("");
          setIsError(false);
        }}
      >
        {mode === "login" ? "はじめての方はこちら" : "ログインに戻る"}
      </button>
      <Link className={`${styles.secondaryButton} ${styles.full}`} href="/child/home">
        子どもモードを試す
      </Link>
    </form>
  );
}
