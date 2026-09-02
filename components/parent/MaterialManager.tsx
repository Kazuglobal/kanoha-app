"use client";

import { useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";

interface ChildProfile {
  id: string;
  nickname: string;
}

interface Material {
  id: string;
  page_count: number;
  source_type: keyof typeof sourceLabels;
  status: keyof typeof statusLabels;
  expires_at: string;
  created_at: string;
}

const sourceLabels = {
  school_print: "学校のプリント",
  tablet_screenshot: "タブレットのスクリーンショット",
  textbook: "教科書",
  other: "その他",
} as const;

const statusLabels = {
  pending: "解析待ち",
  analyzing: "解析中",
  done: "解析済み",
  failed: "解析失敗",
} as const;

export function MaterialManager() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/children");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        setIsError(true);
        setMessage("画像を読み込めませんでした。");
        setPending(false);
        return;
      }
      setChildren(body.data);
      const firstChildId = body.data[0]?.id ?? "";
      setChildId(firstChildId);
      if (firstChildId) await loadMaterials(firstChildId);
      else setPending(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMaterials(selectedChildId: string) {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/materials?childId=${encodeURIComponent(selectedChildId)}`);
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      showError("画像を読み込めませんでした。");
      return;
    }
    setMaterials(body.data);
    setIsError(false);
    setPending(false);
  }

  async function deleteMaterial(material: Material) {
    if (!window.confirm("この問題画像をすぐに削除しますか？学習記録は残ります。")) return;
    setPending(true);
    const response = await fetch(`/api/materials/${material.id}`, { method: "DELETE" });
    if (!response.ok) {
      showError("画像を削除できませんでした。");
      return;
    }
    setMaterials((current) => current.filter(({ id }) => id !== material.id));
    setIsError(false);
    setMessage("画像を削除しました。");
    setPending(false);
  }

  /** 解析失敗(status=failed)の画像を、同じ内容でもう一度解析にかける。 */
  async function reanalyzeMaterial(material: Material) {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/ai/analyze-problem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId, materialId: material.id }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.success) {
      showError("もう一度解析できませんでした。しばらくしてからお試しください。");
      setPending(false);
      return;
    }
    await loadMaterials(childId);
    setIsError(false);
    setMessage("もう一度解析しました。");
    setPending(false);
  }

  function showError(error: string) {
    setIsError(true);
    setMessage(error);
    setPending(false);
  }

  return (
    <section className={styles.panel} style={{ marginTop: 18 }}>
      <h2 className={styles.sectionTitle}>保存した問題画像</h2>
      <p className={styles.tiny}>画像は期限日に自動削除されます。ここからすぐに削除することもできます。</p>
      <label className={styles.field}>表示する子ども
        <select
          disabled={pending}
          value={childId}
          onChange={(event) => {
            setChildId(event.target.value);
            void loadMaterials(event.target.value);
          }}
        >
          {children.length === 0 ? <option value="">プロフィールを先に作成してください</option> : null}
          {children.map((child) => <option key={child.id} value={child.id}>{child.nickname}</option>)}
        </select>
      </label>
      {!pending && childId && materials.length === 0 ? <p className={styles.tiny}>保存中の画像はありません。</p> : null}
      <div className={styles.list}>
        {materials.map((material) => (
          <div className={styles.listRow} key={material.id}>
            <span>
              <strong>{sourceLabels[material.source_type]} / {material.page_count}ページ</strong>
              <br />
              <small className={styles.tiny}>
                {statusLabels[material.status]} / {new Date(material.expires_at).toLocaleDateString("ja-JP")}に自動削除
              </small>
            </span>
            <span className={styles.profileActions}>
              {material.status === "failed" ? (
                <button
                  className={styles.secondaryButton}
                  disabled={pending}
                  type="button"
                  onClick={() => void reanalyzeMaterial(material)}
                >
                  もういちど かいせき
                </button>
              ) : null}
              <button
                aria-label="画像を削除"
                className={styles.dangerButton}
                disabled={pending}
                type="button"
                onClick={() => void deleteMaterial(material)}
              >
                削除
              </button>
            </span>
          </div>
        ))}
      </div>
      {message ? <p aria-live="polite" className={isError ? styles.feedbackWrong : styles.feedback} role={isError ? "alert" : "status"}>{message}</p> : null}
    </section>
  );
}
