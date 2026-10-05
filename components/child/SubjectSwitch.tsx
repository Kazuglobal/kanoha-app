import Link from "next/link";
import type { Route } from "next";
import { SUBJECTS, SUBJECT_CONFIG, type Subject } from "@/lib/curriculum/subjects";
import styles from "@/components/kanoha.module.css";

export function SubjectSwitch({
  currentSubject,
  childId,
  className,
}: {
  currentSubject: Subject;
  childId?: string;
  className?: string;
}) {
  const queryBase = childId ? `childId=${childId}&` : "";

  return (
    <nav aria-label="きょうかを えらぶ" className={`${styles.profileTabs} ${className ?? ""}`}>
      {SUBJECTS.map((subject) => {
        const active = currentSubject === subject;
        return (
          <Link
            key={subject}
            href={`/child/home?${queryBase}subject=${subject}` as Route}
            className={active ? styles.profileTabActive : styles.profileTab}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true" className={styles.subjectTabEmoji}>
              {SUBJECT_CONFIG[subject].emoji}
            </span>
            <span>{SUBJECT_CONFIG[subject].child}</span>
          </Link>
        );
      })}
    </nav>
  );
}
