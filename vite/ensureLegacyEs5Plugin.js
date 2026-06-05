import { transformSync } from '@babel/core';

const BABEL_OPTS = {
  babelrc: false,
  configFile: false,
  plugins: [
    '@babel/plugin-transform-optional-chaining',
    '@babel/plugin-transform-nullish-coalescing-operator',
  ],
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { chrome: '53' },
        bugfixes: true,
        modules: false,
      },
    ],
  ],
  compact: true,
  minified: true,
};

/**
 * Segunda pasada Babel sobre chunks *-legacy* (hook renderChunk, después de plugin-legacy).
 */
export function ensureLegacyEs5Plugin() {
  return {
    name: 'ensure-legacy-es5',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (!chunk.fileName.includes('legacy')) return null;
      if (chunk.fileName.includes('polyfills-legacy')) return null;

      const result = transformSync(code, BABEL_OPTS);
      if (!result?.code) return null;
      return { code: result.code, map: null };
    },
  };
}
