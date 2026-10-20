import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Config de tests separada de `vite.config.js` a propósito: ese archivo tiene
 * lógica dependiente de marca/env (inyección de token, plugin legacy, etc.)
 * que no aplica y solo agregaría riesgo/ruido a una corrida de tests unitarios.
 */
export default defineConfig({
  // Vega (React Native) lo define en el build; en los tests de sus módulos puros, false.
  define: { __DEV__: 'false' },
  resolve: {
    alias: {
      '@appvideo/core': fileURLToPath(new URL('./packages/core/src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // Vega: sólo tests de lógica pura (sin importar react-native).
    include: ['src/**/*.test.{js,jsx}', 'packages/*/src/**/*.test.{js,jsx}', 'apps/vega/src/**/*.test.{js,jsx}'],
    globals: false,
  },
});
