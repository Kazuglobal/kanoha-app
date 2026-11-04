import "server-only";
import type { GeneratedProblem } from "@/lib/ai/schemas";
import type { Subject } from "@/lib/curriculum/subjects";
import type { Level } from "@/lib/learning/level";

export type { GeneratedProblem };

export interface GenerateInput {
  readonly unit: string;
  readonly subUnit: string;
  readonly level: Level;
  /** 同じ seed なら同じ問題になる(長い seed は ref に入れるとき短くたたまれる) */
  readonly seed: string;
}

/** 単元 × 小単元ごとの問題の作り手。答えは入力のパラメータから計算し、AI には作らせない。 */
export interface GeneratorEntry {
  readonly subject: Subject;
  readonly unit: string;
  readonly subUnit: string;
  /** レベル 1〜5 で何がどう変わるか(親の画面・テストの説明用) */
  readonly levels: Readonly<Record<Level, string>>;
  /**
   * 問題をつくる。つくった問題を `validateGenerated` で検査し、通らなければ seed に「#1」「#2」…を足して
   * つくりなおす(同じ入力なら同じ結果)。検査に通る問題を返せなければ RangeError。ふだんはこちらを使う。
   */
  readonly generate: (input: GenerateInput) => GeneratedProblem;
  /** 検査もやりなおしもしない 1 回きりの生成。作りそこない(検査に通らない問題)の割合をテストで調べるために使う。 */
  readonly generateOnce: (input: GenerateInput) => GeneratedProblem;
}
