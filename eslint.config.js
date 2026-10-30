import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'apps/vega/build', 'apps/vega/src/w3cmedia/**']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Mantener señal, pero no bloquear el proyecto por deuda técnica existente.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],

      // Estas reglas nuevas están generando muchos falsos positivos / refactors grandes.
      // Preferimos mantener funcionalidad estable en TVs antes que reescribir componentes.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },

  // Código compartido con Vega: sin globals de navegador. Si hace falta algo
  // del entorno, pasar por `platform/storage` o `platform/runtime`.
  {
    files: ['packages/core/src/**/*.{js,jsx}'],
    ignores: ['packages/core/src/**/__tests__/**'],
    languageOptions: {
      globals: {
        ...globals['shared-node-browser'],
        ...Object.fromEntries(
          Object.keys(globals.browser)
            .filter((name) => !(name in globals['shared-node-browser']))
            .map((name) => [name, 'off']),
        ),
      },
    },
  },

  // App Vega (React Native): globals de RN.
  {
    files: ['apps/vega/index.js', 'apps/vega/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals['shared-node-browser'],
        __DEV__: 'readonly',
        global: 'readonly',
        require: 'readonly',
      },
    },
    // Regla del refresco en caliente de Vite: no aplica a React Native.
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['apps/vega/{babel,metro}.config.js', 'apps/vega/babel/**/*.js', 'apps/vega/scripts/**/*.js'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
  },

  // Archivos Node (scripts/config) — permitir `process`, etc.
  {
    files: ['vite.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
