import { defineConfig } from 'vitest/config';
// Uji UI menyeluruh terhadap tumpukan yang sedang berjalan (web + 5 layanan, data demo).
export default defineConfig({ test: { include: ['e2e/**/*.e2e.ts'], testTimeout: 90_000, hookTimeout: 90_000, fileParallelism: false } });
