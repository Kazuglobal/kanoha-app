import Link from "next/link";
import type { Subject } from "@/lib/curriculum/subjects";
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
      <Link
        href={`/child/home?${queryBase}subject=math`}
        className={currentSubject === "math" ? styles.profileTabActive : styles.profileTab}
        aria-current={currentSubject === "math" ? "page" : undefined}
      >
        <span aria-hidden="true" style={{ fontSize: "1.25rem", marginRight: "2px" }}>🧮</span>
        <span>さんすう</span>
      </Link>
      <Link
        href={`/child/home?${queryBase}subject=japanese`}
        className={currentSubject === "japanese" ? styles.profileTabActive : styles.profileTab}
        aria-current={currentSubject === "japanese" ? "page" : undefined}
      >
        <span aria-hidden="true" style={{ fontSize: "1.25rem", marginRight: "2px" }}>📖</span>
        <span>こくご</span>
      </Link>
    </nav>
  );
}
