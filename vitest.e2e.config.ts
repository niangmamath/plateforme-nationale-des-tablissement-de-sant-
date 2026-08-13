import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Tests séquentiels : ils pilotent le même navigateur headless l'un après l'autre,
    // pas besoin (ni intérêt) de paralléliser plusieurs instances Chrome en CI.
    fileParallelism: false,
  },
});
