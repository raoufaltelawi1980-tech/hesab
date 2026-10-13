import { defineConfig } from 'vitest/config';

// Resolves the path aliases declared in tsconfig.json, including the ones
// added by `nest g library`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
