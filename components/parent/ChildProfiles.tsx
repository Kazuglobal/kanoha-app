"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";

interface ChildProfile {
  id: string;
  nickname: string;
  grade: number;
  reading_mode: "kanji_with_ruby" | "hiragana";
}

interface FormState {
  nickname: string;
  grade: number;
  readingMode: ChildProfile["reading_mode"];
}

const emptyForm: FormState = {
  nickname: "",
  grade: 2,
  readingMode: "kanji_with_ruby",
};

export function ChildProfiles() {
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(true);

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function loadProfiles() {
    setPending(true);
    const response = await fetch("/api/children");
    const body = await response.json().catch(() => null);
    setProfiles(response.ok && body?.success ? body.data : []);
    if (!response.ok) setMessage("プロフィールを読み込めませんでした。");
    setPending(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const response = await fetch(editingId ? `/api/children/${editingId}` : "/api/children", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setMessage("プロフィールを保存できませんでした。");
      setPending(false);
      return;
    }

    setProfiles((current) => editingId
      ? current.map((profile) => profile.id === editingId ? body.data : profile)
      : [...current, body.data]);
    setForm(emptyForm);
    setEditingId(null);
    setMessage("プロフィールを保存しました。");
    setPending(false);
  }

  async function deleteProfile(profile: ChildProfile) {
    if (!window.confirm(`${profile.nickname}さんのプロフィールと学習記録を削除しますか？`)) return;
    setPending(true);
    const response = await fetch(`/api/children/${profile.id}`, { method: "DELETE" });
    if (response.ok) {
      setProfiles((current) => current.filter(({ id }) => id !== profile.id));
      if (editingId === profile.id) cancelEditing();
      setMessage("プロフィールを削除しました。");
    } else {
      setMessage("プロフィールを削除できませんでした。");
    }
    setPending(false);
  }

  function editProfile(profile: ChildProfile) {
    setEditingId(profile.id);
    setForm({
      nickname: profile.nickname,
      grade: profile.grade,
      readingMode: profile.reading_mode,
    });
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}>子どもプロフィール</h2>
      {pending && profiles.length === 0 ? <p className={styles.tiny}>読み込み中...</p> : null}
      <div className={styles.list}>
        {profiles.map((profile) => (
          <div className={styles.listRow} key={profile.id}>
            <span>
              <strong>{profile.nickname}</strong>
              <br />
              <small className={styles.tiny}>小学{profile.grade}年生</small>
            </span>
            <span className={styles.profileActions}>
              <button className={styles.ghostButton} disabled={pending} type="button" onClick={() => editProfile(profile)}>
                編集
              </button>
              <button className={styles.dangerButton} disabled={pending} type="button" onClick={() => void deleteProfile(profile)}>
                削除
              </button>
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <label className={styles.field}>
          ニックネーム
          <input
            maxLength={40}
            required
            value={form.nickname}
            onChange={(event) => setForm({ ...form, nickname: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          学年
          <select
            value={form.grade}
            onChange={(event) => setForm({ ...form, grade: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>小学{grade}年生</option>)}
          </select>
        </label>
        <label className={styles.field}>
          文字の表示
          <select
            value={form.readingMode}
            onChange={(event) => setForm({ ...form, readingMode: event.target.value as FormState["readingMode"] })}
          >
            <option value="kanji_with_ruby">漢字とルビ</option>
            <option value="hiragana">ひらがな中心</option>
          </select>
        </label>
        <p className={styles.tiny}>本名・学校名・クラス名は登録しないでください。</p>
        <div className={styles.hintActions}>
          <button className={styles.primaryButton} disabled={pending} type="submit">
            {editingId ? "変更を保存" : "プロフィールを追加"}
          </button>
          {editingId ? (
            <button className={styles.secondaryButton} disabled={pending} type="button" onClick={cancelEditing}>
              キャンセル
            </button>
          ) : null}
        </div>
        {message ? <p aria-live="polite" className={styles.feedback}>{message}</p> : null}
      </form>
    </section>
  );
}

