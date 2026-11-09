/**
 * Ejecuta check-es-compat sobre el directorio de salida del build.
 * Uso: node scripts/postbuild-es-check.js [marca|dist/ruta]
 */

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { babelLegacyDist } from './babel-legacy-dist.js';

const arg = process.argv[2] || process.env.VITE_BRAND || '';
const dir = arg.startsWith('dist/') ? arg : arg ? `dist/${arg}` : 'dist';

if (!existsSync(dir)) {
  console.warn(`⚠️  postbuild-es-check: no existe "${dir}", se omite verificación ES.`);
  process.exit(0);
}

/**
 * Borra los `._*` que macOS crea junto a cada archivo en discos exFAT
 * (AppleDouble con atributos extendidos): no son parte del build y no deben
 * llegar a los paquetes de TV ni al servidor.
 */
function removeAppleDouble(root) {
  let removed = 0;
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (entry.startsWith('._')) {
      rmSync(full, { force: true });
      removed++;
    } else if (statSync(full).isDirectory()) {
      removed += removeAppleDouble(full);
    }
  }
  return removed;
}

const babelResult = babelLegacyDist(dir);
if (babelResult.changed > 0) {
  console.log(`[postbuild] Babel legacy: ${babelResult.changed}/${babelResult.files} chunk(s) retranspilados.`);
}

execSync(`node scripts/check-es-compat.js ${dir}`, { stdio: 'inherit' });

// Al final: la pasada de Babel reescribe chunks y en exFAT eso vuelve a crear `._`.
const removedAppleDouble = removeAppleDouble(dir);
if (removedAppleDouble > 0) {
  console.log(`[postbuild] ${removedAppleDouble} archivo(s) ._ de macOS borrados de ${dir}.`);
}
