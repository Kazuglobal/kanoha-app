"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import styles from "@/components/kanoha.module.css";
import type { Subject } from "@/lib/curriculum/subjects";
import { PRACTICE_TEXT } from "./childStrings";
import { problemHref } from "./links";
import { fetchPracticeSet, type PracticeSet, type PracticeSetResult } from "./practiceApi";

type View =
  | { kind: "loading" }
  | { kind: "set"; set: PracticeSet }
  | { kind: "limit" }
  | { kind: "error" }
  | { kind: "hidden" };

const toView = (result: PracticeSetResult): View => {
  if (result.kind === "ready") return { kind: "set", set: result.set };
  if (result.kind === "limit") return { kind: "limit" };
  if (result.kind === "error") return { kind: "error" };
  return { kind: "hidden" };
};

/**
 * ホームの「あたらしい もんだい」。その子の進み具合に合わせた 5もんを、教科ごとに出す。
 * 開いたときに今日のセットを取りにいく(同じ日は何度開いても同じセット)。ログイン中の子どもだけで、使えないときは何も出さない。
 */
export function NewPracticeCard({ childId, subject }: { childId: string; subject: Subject }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const latest = useRef(0);

  const load = useCallback(
    async (more: boolean) => {
      latest.current += 1;
      const mine = latest.current;
      setView({ kind: "loading" });
      const result = await fetchPracticeSet(childId, subject, more);
      // 教科が変わったあとに届いた古い返事は使わない
      if (latest.current === mine) setView(toView(result));
    },
    [childId, subject],
  );

  useEffect(() => {
    void load(false);
    return () => {
      latest.current += 1;
    };
  }, [load]);

  if (view.kind === "hidden") return null;
  return (
    <section className={styles.practiceCard} aria-label={PRACTICE_TEXT.title}>
      <div className={styles.practiceHead}>
        <span className={styles.practiceIcon} aria-hidden="true">✨</span>
        <div className={styles.practiceText}>
          <h2 className={styles.practiceTitle}>{PRACTICE_TEXT.title}</h2>
          <p className={styles.practiceLead}>{PRACTICE_TEXT.lead}</p>
        </div>
      </div>
      <PracticeBody view={view} childId={childId} onMore={() => void load(true)} onRetry={() => void load(false)} />
    </section>
  );
}

function PracticeBody({ view, childId, onMore, onRetry }: { view: View; childId: string; onMore: () => void; onRetry: () => void }) {
  if (view.kind === "loading") return <p role="status" className={styles.practiceNote}>{PRACTICE_TEXT.loading}</p>;
  if (view.kind === "limit") return <p className={styles.practiceNote}>{PRACTICE_TEXT.tomorrow}</p>;
  if (view.kind === "error") {
    return (
      <div className={styles.practiceActions}>
        <p className={styles.practiceNote}>{PRACTICE_TEXT.failed}</p>
        <button className={styles.secondaryButton} type="button" onClick={onRetry}>{PRACTICE_TEXT.retry}</button>
      </div>
    );
  }
  if (view.kind === "hidden") return null;

  const { set } = view;
  const total = set.items.length;
  const done = set.items.filter((item) => item.done).length;
  const next = set.items.find((item) => !item.done);
  return (
    <div className={styles.practiceActions}>
      <div
        className={styles.practiceBarTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={total === 0 ? 0 : Math.round((done / total) * 100)}
        aria-label={`${done} / ${total}`}
      >
        <div className={styles.practiceBarFill} style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
      </div>
      <p className={styles.practiceNote}>{`${done} / ${total} ${PRACTICE_TEXT.progressSuffix}`}</p>
      {next ? (
        <Link
          className={styles.primaryButton}
          href={problemHref(next.problemId, childId, set.batchId) as Route}
        >
          {done === 0 ? PRACTICE_TEXT.start : PRACTICE_TEXT.resume}
        </Link>
      ) : set.remainingSets > 0 ? (
        <>
          <p className={styles.practiceNote}>{PRACTICE_TEXT.allDone}</p>
          <button className={styles.primaryButton} type="button" onClick={onMore}>{PRACTICE_TEXT.more}</button>
        </>
      ) : (
        <p className={styles.practiceNote}>{PRACTICE_TEXT.tomorrow}</p>
      )}
    </div>
  );
}
