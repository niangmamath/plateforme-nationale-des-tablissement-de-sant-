import { defineConfig } from 'vitest/config';

// Tests unitaires (calculs purs, sans navigateur ni base). Les tests de bout en bout gardent leur
// propre configuration : vitest.e2e.config.ts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
