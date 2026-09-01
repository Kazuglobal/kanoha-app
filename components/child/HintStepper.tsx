"use client";

import { Eye, Image as ImageIcon, WandSparkles } from "lucide-react";
import { useState } from "react";
import styles from "@/components/kanoha.module.css";
import { RubyAuto } from "./RubyText";

const labels = ["ヒント 1", "ヒント 2", "ときかた", "こたえ"] as const;

export function HintStepper({
  hints,
  readingMode = "kanji_with_ruby",
  onReveal,
  onSimplify,
  simplifying = false,
  onVisual,
  visualPending = false,
  visualUrl,
}: {
  hints: readonly [string, string, string, string];
  readingMode?: "kanji_with_ruby" | "hiragana";
  onReveal?: (visibleCount: number) => void;
  onSimplify?: () => void;
  simplifying?: boolean;
  onVisual?: () => void;
  visualPending?: boolean;
  visualUrl?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showVisual, setShowVisual] = useState(false);

  return (
    <section className={styles.hintArea} aria-label="だんかいヒント">
      <div className={styles.hintSteps}>
        {hints.slice(0, visibleCount).map((hint, index) => (
          <article className={styles.hintItem} key={labels[index]}>
            <strong>{labels[index]}</strong>
            <p><RubyAuto text={hint} readingMode={readingMode} /></p>
          </article>
        ))}
        {visualUrl ? (
          <article className={styles.hintItem}>
            <strong>えで かんがえよう</strong>
            {/* The API returns a same-origin static template or an ephemeral generated image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="もんだいの えヒント" className={styles.visualHintImage} src={visualUrl} />
          </article>
        ) : showVisual ? (
          <article className={styles.hintItem}>
            <strong>えで かんがえよう</strong>
            <p>100mL の コップが 10こ あつまると、1L になるよ。</p>
          </article>
        ) : null}
      </div>
      <div className={styles.hintActions}>
        {visibleCount < hints.length ? (
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setVisibleCount((count) => {
              const next = count + 1;
              onReveal?.(next);
              return next;
            })}
          >
            <Eye size={20} aria-hidden="true" />
            {visibleCount === 0 ? "ヒントを みる" : `つぎの ${labels[visibleCount]}を みる`}
          </button>
        ) : null}
        <button
          className={styles.secondaryButton}
          disabled={visualPending}
          type="button"
          onClick={() => onVisual ? onVisual() : setShowVisual(true)}
        >
          <ImageIcon size={20} aria-hidden="true" />
          {visualPending ? "えを じゅんび中..." : "えで おしえて"}
        </button>
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
