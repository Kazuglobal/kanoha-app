/**
 * 環境変数の数値(0以上)を呼び出し時に読む。未設定・空・数値でない・負のときは fallback。
 * Workers では環境変数がリクエスト時にしか確定しないので、モジュール読み込み時に読まない。0 は有効な値。
 */
export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
