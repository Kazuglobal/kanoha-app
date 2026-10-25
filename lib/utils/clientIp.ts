/**
 * レート制限用のクライアント識別子。
 * `x-forwarded-for` はクライアントが自由に書けるので使わない。
 * Cloudflare が付ける `cf-connecting-ip` を優先し、無ければ `x-real-ip`。
 */
export function clientIpFrom(request: Request): string {
  const ip =
    request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : "unknown";
}
