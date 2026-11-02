import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Config de tests separada de `vite.config.js` a propósito: ese archivo tiene
 * lógica dependiente de marca/env (inyección de token, plugin legacy, etc.)
 * que no aplica y solo agregaría riesgo/ruido a una corrida de tests unitarios.
 */
export default defineConfig({
  // Los .ts de Vega (keyUnwrap.ts) heredan de un tsconfig de React Native que no está instalado
  // en el workspace web; esbuild no necesita el tsconfig para transpilar en los tests.
  esbuild: { tsconfigRaw: '{}' },
  // Vega (React Native) lo define en el build; en los tests de sus módulos puros, false.
  define: { __DEV__: 'false' },
  resolve: {
    alias: {
      '@appvideo/core': fileURLToPath(new URL('./packages/core/src', import.meta.url)),
      '@amazon-devices/react-native-w3cmedia/dist/headless': fileURLToPath(
        new URL('./apps/vega/src/__tests__/stubs/w3cmediaHeadless.js', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    // Vega: sólo tests de lógica pura (sin importar react-native).
    include: ['src/**/*.test.{js,jsx}', 'packages/*/src/**/*.test.{js,jsx}', 'apps/vega/src/**/*.test.{js,jsx}'],
    globals: false,
  },
});
