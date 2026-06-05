/**
 * Verifica que los chunks de producción no contengan sintaxis ES incompatible
 * con LG webOS 4.5 (Chrome 53) / Samsung Tizen 5 (Chrome 63).
 *
 * Uso: pnpm run build && node scripts/check-es-compat.js [directorio]
 * Por defecto escanea dist/ y subcarpetas de marca.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.argv[2] || 'dist';

/** Chunks de terceros donde ?? puede ser polyfill intencional */
const IGNORE_FILE_PATTERNS = [
  /polyfills-legacy/i,
  /videojs-hlsjs-plugin/i,
];

/** Quita literales regex para no confundir /\?.*$/ con optional chaining */
function stripRegexLiterals(code) {
  return code.replace(/\/(?:\\.|[^/\\])+\/[gimsuvy]*/g, '');
}

function hasOptionalChaining(code) {
  // ?.prop — no confundir con ternarios del estilo cond?.65:1 (opacity en JSX minificado)
  return /\?\.(?:[a-zA-Z_$]|\[|\()/.test(stripRegexLiterals(code));
}

function hasNullishCoalescing(code) {
  return /\?\?/.test(stripRegexLiterals(code));
}

function collectJsFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectJsFiles(full, out);
    } else if (extname(entry) === '.js' && !entry.includes('.map')) {
      out.push(full);
    }
  }
  return out;
}

const files = collectJsFiles(root);
if (files.length === 0) {
  console.warn(`⚠️  No se encontraron archivos .js en "${root}". Ejecuta "pnpm run build" primero.`);
  process.exit(0);
}

const violations = [];

for (const file of files) {
  if (IGNORE_FILE_PATTERNS.some((re) => re.test(file))) continue;

  const code = readFileSync(file, 'utf8');
  if (hasOptionalChaining(code)) {
    violations.push({ file, syntax: 'optional chaining (?.)' });
  }
  if (hasNullishCoalescing(code)) {
    violations.push({ file, syntax: 'nullish coalescing (??)' });
  }
}

if (violations.length > 0) {
  console.error('❌ Chunks con sintaxis posiblemente incompatible con Chrome 53/63:\n');
  violations.forEach((v, i) => {
    console.error(`   ${i + 1}. ${v.file} → ${v.syntax}`);
  });
  process.exit(1);
}

console.log(`✅ ${files.length} archivo(s) JS en "${root}" sin ?. ni ?? detectables.`);
