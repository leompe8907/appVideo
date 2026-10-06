import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Config de tests separada de `vite.config.js` a propósito: ese archivo tiene
 * lógica dependiente de marca/env (inyección de token, plugin legacy, etc.)
 * que no aplica y solo agregaría riesgo/ruido a una corrida de tests unitarios.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@appvideo/core': fileURLToPath(new URL('./packages/core/src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}', 'packages/*/src/**/*.test.{js,jsx}'],
    globals: false,
  },
});
