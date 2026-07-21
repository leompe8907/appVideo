import { defineConfig } from 'vitest/config';

/**
 * Config de tests separada de `vite.config.js` a propósito: ese archivo tiene
 * lógica dependiente de marca/env (inyección de token, plugin legacy, etc.)
 * que no aplica y solo agregaría riesgo/ruido a una corrida de tests unitarios.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    globals: false,
  },
});
