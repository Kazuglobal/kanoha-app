"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** 端末の「動きを減らす」設定を、framer-motion のアニメーション全体に効かせる(CSS の動きは各 CSS 側の prefers-reduced-motion で止める)。 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
