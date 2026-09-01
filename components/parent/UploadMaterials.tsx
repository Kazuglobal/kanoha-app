"use client";

import { FileImage, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import styles from "@/components/kanoha.module.css";

interface ChildProfile {
  id: string;
  nickname: string;
}

interface UploadedMaterial {
  id: string;
  page_count: number;
}

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function UploadMaterials() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [files, setFiles] = useState<readonly File[]>([]);
  const [sourceType, setSourceType] = useState("school_print");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedMaterial | null>(null);
  const [problemId, setProblemId] = useState("");

  useEffect(() => {
    void loadChildren();
  }, []);

  async function loadChildren() {
    const response = await fetch("/api/children");
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setIsError(true);
      setMessage("子どもプロフィールを読み込めませんでした。");
      return;
    }
    setChildren(body.data);
    setChildId(body.data[0]?.id ?? "");
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);
    const invalid = selected.length > MAX_FILES ||
      totalBytes > MAX_TOTAL_BYTES ||
      selected.some((file) => file.size > MAX_FILE_BYTES || !ACCEPTED_TYPES.has(file.type));

    setUploaded(null);
    setProblemId("");
    if (invalid) {
      setFiles([]);
      setIsError(true);
      setMessage("JPEG・PNG・WebPを10ページ、合計30MBまで選べます。");
      event.target.value = "";
      return;
    }
    setIsError(false);
    setMessage("");
    setFiles(selected);
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!childId || files.length === 0) return;
    setPending(true);
    setMessage("画像をアップロードしています...");
    setIsError(false);
    setUploaded(null);
    setProblemId("");

    const form = new FormData();
    form.set("childId", childId);
    form.set("sourceType", sourceType);
    files.forEach((file) => form.append("files", file));

    const uploadResponse = await fetch("/api/materials/upload", { method: "POST", body: form });
    const uploadBody = await uploadResponse.json().catch(() => null);
    if (!uploadResponse.ok || !uploadBody?.success) {
      setIsError(true);
      setMessage("アップロードできませんでした。画像を確認してもう一度お試しください。");
      setPending(false);
      return;
    }

    setUploaded(uploadBody.data);
    setMessage("画像を受け付けました。問題を解析しています...");
    const analysisResponse = await fetch("/api/ai/analyze-problem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId, materialId: uploadBody.data.id }),
    });
    const analysisBody = await analysisResponse.json().catch(() => null);
    if (!analysisResponse.ok || !analysisBody?.success) {
      setIsError(true);
      setMessage("画像は保存しましたが、解析に失敗しました。あとでもう一度解析してください。");
      setPending(false);
      return;
    }

    setMessage(`解析が完了しました。「${analysisBody.data.problem_text}」を登録しました。`);
    setProblemId(analysisBody.data.id);
    setFiles([]);
    setPending(false);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setMessage("");
    setUploaded(null);
  }

  return (
    <section className={styles.panel}>
      <form onSubmit={submitUpload}>
        <label className={styles.field}>
          学習する子ども
          <select required value={childId} onChange={(event) => setChildId(event.target.value)}>
            {children.length === 0 ? <option value="">プロフィールを先に作成してください</option> : null}
            {children.map((child) => <option key={child.id} value={child.id}>{child.nickname}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          画像の種類
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="school_print">学校のプリント</option>
            <option value="tablet_screenshot">タブレットのスクリーンショット</option>
            <option value="textbook">教科書</option>
            <option value="other">その他</option>
          </select>
        </label>
        <div className={styles.uploadZone}>
          <UploadCloud size={42} color="#0d9f8c" aria-hidden="true" />
          <h2 className={styles.sectionTitle}>プリントやスクリーンショットを追加</h2>
          <p className={styles.tiny}>名前や学校名が写っていないことを確認してください。JPEG・PNG・WebP、最大10ページです。</p>
          <label className={styles.primaryButton}>
            画像を選ぶ
            <input
              accept="image/jpeg,image/png,image/webp"
              hidden
              multiple
              type="file"
              onChange={selectFiles}
            />
          </label>
        </div>
        {files.length > 0 ? (
          <>
            <div className={styles.list}>
              {files.map((file, index) => (
                <div className={styles.listRow} key={`${file.name}-${file.size}-${index}`}>
                  <span><FileImage size={17} /> {file.name}</span>
                  <span className={styles.profileActions}>
                    <span className={styles.tag}>{Math.ceil(file.size / 1024)} KB</span>
                    <button
                      aria-label={`${file.name}を外す`}
                      className={styles.iconButton}
                      disabled={pending}
                      type="button"
                      onClick={() => removeFile(index)}
                    >
                      <X size={17} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <button className={styles.primaryButton} disabled={pending || !childId} type="submit">
              {pending ? "処理しています..." : `${files.length}ページを解析する`}
            </button>
          </>
        ) : null}
        {message ? (
          <p aria-live="polite" className={isError ? styles.feedbackWrong : styles.feedback} role={isError ? "alert" : "status"}>
            {message}
          </p>
        ) : null}
        {uploaded && isError ? (
          <p className={styles.tiny}>受付番号: {uploaded.id.slice(0, 8)} / {uploaded.page_count}ページ</p>
        ) : null}
        {problemId ? (
          <Link className={styles.primaryButton} href={`/child/problem/${problemId}?childId=${childId}`}>
            この問題を はじめる
          </Link>
        ) : null}
      </form>
    </section>
  );
}
