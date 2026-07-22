/**
 * Tercera pasada Babel sobre archivos *-legacy*.js en disco (por si renderChunk no alcanza).
 * Uso interno desde postbuild-es-check.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
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

function collectLegacyJs(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectLegacyJs(full, out);
      continue;
    }
    if (
      extname(entry) === '.js' &&
      entry.includes('legacy') &&
      !entry.includes('polyfills-legacy')
    ) {
      out.push(full);
    }
  }
  return out;
}

export function babelLegacyDist(root) {
  const files = collectLegacyJs(root);
  let changed = 0;
  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    const result = transformSync(code, BABEL_OPTS);
    if (result?.code) {
      writeFileSync(file, result.code, 'utf8');
      if (result.code !== code) changed++;
    }
  }
  return { files: files.length, changed };
}
