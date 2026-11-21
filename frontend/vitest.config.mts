import { defineConfig } from 'vitest/config';

// Unit tests of the visitor engine (plain TypeScript, no Angular needed).
export default defineConfig({
  test: {
    include: ['src/app/visitor/engine/**/*.spec.ts'],
    environment: 'node',
  },
});
