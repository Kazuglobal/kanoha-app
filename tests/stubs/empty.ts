/**
 * `import "server-only"` の置き換え(vitest.config.ts の alias)。
 * Next のビルドは自前の `server-only` を使うので、テストでだけ空のモジュールにする。
 */
export {};
