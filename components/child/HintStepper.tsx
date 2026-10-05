"use client";

import { Eye, Image as ImageIcon, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";
import { RubyAuto } from "./RubyText";

const labels = ["ヒント 1", "ヒント 2", "ときかた", "こたえ"] as const;
const stepIcons = ["💡", "🔍", "✏️", "🎯"] as const;

/** 「えで おしえて」はヒント2以降でだけ出す(doc §7 手順6)。 */
const VISUAL_MIN_REVEALED = 2;

/**
 * 段階式ヒント(A2)。表示できるのは親から渡された `revealed`(サーバーが 1 段ずつ返した文)だけ。
 * 次の段階は `onRequestNext` でサーバーに取りに行く。`hints` は静的フォールバック(テスト用)。
 */
export function HintStepper({
  hints,
  revealed,
  onRequestNext,
  readingMode = "kanji_with_ruby",
  onReveal,
  onSimplify,
  simplifying = false,
  onVisual,
  visualPending = false,
  visualUrl,
}: {
  hints?: readonly string[];
  revealed?: readonly string[];
  onRequestNext?: () => Promise<boolean>;
  readingMode?: "kanji_with_ruby" | "hiragana";
  onReveal?: (visibleCount: number) => void;
  onSimplify?: () => void;
  simplifying?: boolean;
  onVisual?: () => void;
  visualPending?: boolean;
  visualUrl?: string;
}) {
  const [localRevealed, setLocalRevealed] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const shown = revealed ?? localRevealed;
  const nextIndex = Math.min(shown.length, labels.length - 1);
  const latestRef = useRef<HTMLElement | null>(null);
  const shownCount = shown.length + (visualUrl ? 1 : 0);

  // 新しいヒントが開いたら、スクロール領域の中でそこまで見せる(スマホは1画面固定のため)
  useEffect(() => {
    if (shownCount === 0) return;
    latestRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [shownCount]);

  async function revealNext() {
    if (loading || shown.length >= labels.length) return;
    if (onRequestNext) {
      setLoading(true);
      const ok = await onRequestNext();
      setLoading(false);
      if (!ok) return;
    } else if (hints) {
      setLocalRevealed(hints.slice(0, shown.length + 1));
    }
    onReveal?.(shown.length + 1);
  }

  return (
    <section className={styles.hintArea} aria-label="だんかいヒント">
      <div className={styles.hintSteps}>
        {shown.map((hint, index) => (
          <article
            className={styles.hintItem}
            key={labels[index]}
            ref={!visualUrl && index === shown.length - 1 ? latestRef : undefined}
          >
            <strong>
              <span aria-hidden="true">{stepIcons[index] ?? "💡"}</span> {labels[index]}
            </strong>
            <p><RubyAuto text={hint} readingMode={readingMode} /></p>
          </article>
        ))}
        {visualUrl ? (
          <article className={styles.visualHintCard} ref={latestRef}>
            <div className={styles.visualHintHeader}>
              <ImageIcon size={22} color="#0d9f8c" />
              <span>えで かんがえよう！</span>
            </div>
            {/* The API returns a same-origin static template or an ephemeral generated image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="もんだいの えヒント" className={styles.visualHintImage} src={visualUrl} />
            <p className={styles.visualHintCaption}>
              💡 えの かずや めもりを みて、じゅんばんに かんがえてみよう！
            </p>
          </article>
        ) : null}
      </div>
      {shown.length === 0 && !visualUrl ? (
        <p className={styles.hintTip}>
          💡 こまったら「ヒントを みる」を おしてね
        </p>
      ) : null}
      {shown.length === 1 && !visualUrl ? (
        <p className={styles.hintTip}>
          💡 もうひとつ ヒントを みると、「えで おしえて」が つかえるよ！
        </p>
      ) : null}
      <div className={styles.hintActions}>
        {shown.length < labels.length ? (
          <button className={styles.primaryButton} disabled={loading} type="button" onClick={() => void revealNext()}>
            <Eye size={20} aria-hidden="true" />
            {loading ? "じゅんびちゅう..." : shown.length === 0 ? "ヒントを みる" : `つぎの ${labels[nextIndex]}を みる`}
          </button>
        ) : null}
        {onVisual && shown.length >= VISUAL_MIN_REVEALED ? (
          <button
            className={styles.visualActionButton}
            disabled={visualPending}
            type="button"
            onClick={onVisual}
            aria-label="えで おしえて"
          >
            <ImageIcon size={20} aria-hidden="true" />
            {visualPending ? "えを じゅんびちゅう..." : visualUrl ? "✨ えを ひょうじ中" : "えで おしえて"}
          </button>
        ) : null}
        {onSimplify ? (
          <button className={styles.secondaryButton} disabled={simplifying} type="button" onClick={onSimplify}>
            <WandSparkles size={20} aria-hidden="true" />
            {simplifying ? "かんたんに しているよ..." : "もっと かんたんに"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
