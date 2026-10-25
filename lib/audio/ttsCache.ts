/**
 * 上限つきの LRU キャッシュ。生成した音声(data URL)は1件で数百KBあるため、
 * 長く使う端末(タブレット)でメモリが増え続けないよう、古いものから捨てる。
 */
export interface BoundedCache<V> {
  readonly size: number;
  has(key: string): boolean;
  get(key: string): V | undefined;
  set(key: string, value: V): void;
}

export function createBoundedCache<V>(maxEntries: number): BoundedCache<V> {
  const entries = new Map<string, V>();
  return {
    get size() {
      return entries.size;
    },
    has: (key) => entries.has(key),
    get(key) {
      if (!entries.has(key)) return undefined;
      const value = entries.get(key) as V;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
  };
}
