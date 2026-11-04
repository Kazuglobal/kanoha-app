const encode = encodeURIComponent;

/**
 * 問題画面へのリンク。子どもがいる(ログイン中の)ときだけ `?childId=` を付け、
 * 「あたらしい もんだい」のセットの手がかり `&batch=` も 子どもがいるときだけ付ける。
 */
export function problemHref(problemId: string, childId?: string | null, batchId?: string | null): string {
  const base = `/child/problem/${encode(problemId)}`;
  if (!childId) return base;
  return `${base}?childId=${encode(childId)}${batchId ? `&batch=${encode(batchId)}` : ""}`;
}

/** ホームへのリンク。子どもと教科を引きつぐ(付けないと、いちばん上の子の算数のホームが開く)。 */
export function homeHref(childId?: string | null, subject?: string | null): string {
  const query = [childId ? `childId=${encode(childId)}` : "", subject ? `subject=${encode(subject)}` : ""].filter(Boolean).join("&");
  return query ? `/child/home?${query}` : "/child/home";
}
