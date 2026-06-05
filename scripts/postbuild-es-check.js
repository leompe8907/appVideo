/**
 * Ejecuta check-es-compat sobre el directorio de salida del build.
 * Uso: node scripts/postbuild-es-check.js [marca|dist/ruta]
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { babelLegacyDist } from './babel-legacy-dist.js';

const arg = process.argv[2] || process.env.VITE_BRAND || '';
const dir = arg.startsWith('dist/') ? arg : arg ? `dist/${arg}` : 'dist';

if (!existsSync(dir)) {
  console.warn(`⚠️  postbuild-es-check: no existe "${dir}", se omite verificación ES.`);
  process.exit(0);
}

const babelResult = babelLegacyDist(dir);
if (babelResult.changed > 0) {
  console.log(`[postbuild] Babel legacy: ${babelResult.changed}/${babelResult.files} chunk(s) retranspilados.`);
}

execSync(`node scripts/check-es-compat.js ${dir}`, { stdio: 'inherit' });
