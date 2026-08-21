import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The suite is pure Node — no browser, no jsdom. Pages are parsed with
    // node-html-parser (see tests/support/dist.ts for the choice rationale).
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Runs `pnpm run build` exactly once before any test file loads.
    globalSetup: ['./tests/global-setup.ts'],
    // The one-off production build can be slow on a cold CI runner.
    hookTimeout: 300_000,
    testTimeout: 30_000,
  },
});
