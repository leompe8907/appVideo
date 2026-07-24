/**
 * Verifica que los chunks de producción no contengan sintaxis ES incompatible
 * con LG webOS 4.5 (Chrome 53) / Samsung Tizen 5 (Chrome 63).
 *
 * Usa el AST real (vía @babel/core) en lugar de una regex de texto: así se
 * distingue el operador `??`/`?.` real de una cadena de texto o comentario
 * que solo se le parece (ej. bundles de terceros como video.js usan el
 * literal "??" como marcador interno, sin relación con nullish coalescing).
 *
 * Uso: pnpm run build && node scripts/check-es-compat.js [directorio]
 * Por defecto escanea dist/ y subcarpetas de marca.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parseSync, traverse } from '@babel/core';

const root = process.argv[2] || 'dist';

/** Chunks de terceros donde ?? puede ser polyfill intencional */
const IGNORE_FILE_PATTERNS = [
  /polyfills-legacy/i,
];

// Fallback regex, usado solo si el parseo AST falla (código con dialecto
// que Babel no reconoce). Mismo comportamiento que la versión anterior.
function hasOptionalChainingRegex(code) {
  return /\?\.(?:[a-zA-Z_$]|\[|\()/.test(code);
}

function hasNullishCoalescingRegex(code) {
  return /(^|[^?])\?\?(?!=)/.test(code);
}

/**
 * Analiza el código con el parser de Babel y busca nodos AST reales de
 * optional chaining / nullish coalescing. Devuelve { optionalChaining, nullishCoalescing }
 * o null si el parseo falló (para hacer fallback a regex).
 */
function findRealEs2020Syntax(code, file) {
  let ast;
  try {
    ast = parseSync(code, {
      babelrc: false,
      configFile: false,
      sourceType: 'unambiguous',
      // @babel/parser reconoce ??/?. de forma nativa desde 7.8 (sintaxis
      // stage 4), no hace falta ningún plugin de sintaxis adicional.
    });
  } catch (err) {
    console.warn(`⚠️  No se pudo parsear ${file} para análisis AST (${err.message}). Usando fallback por regex.`);
    return null;
  }

  let optionalChaining = false;
  let nullishCoalescing = false;

  traverse(ast, {
    LogicalExpression(path) {
      if (path.node.operator === '??') {
        nullishCoalescing = true;
      }
    },
    OptionalMemberExpression() {
      optionalChaining = true;
    },
    OptionalCallExpression() {
      optionalChaining = true;
    },
  });

  return { optionalChaining, nullishCoalescing };
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
  const astResult = findRealEs2020Syntax(code, file);

  if (astResult) {
    if (astResult.optionalChaining) {
      violations.push({ file, syntax: 'optional chaining (?.)' });
    }
    if (astResult.nullishCoalescing) {
      violations.push({ file, syntax: 'nullish coalescing (??)' });
    }
  } else {
    // Fallback: el archivo no se pudo parsear (dialecto no reconocido).
    // Mantenemos la detección por regex anterior para no perder cobertura,
    // aceptando el riesgo de falso positivo en ese caso excepcional.
    if (hasOptionalChainingRegex(code)) {
      violations.push({ file, syntax: 'optional chaining (?.) [regex fallback]' });
    }
    if (hasNullishCoalescingRegex(code)) {
      violations.push({ file, syntax: 'nullish coalescing (??) [regex fallback]' });
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Chunks con sintaxis posiblemente incompatible con Chrome 53/63:\n');
  violations.forEach((v, i) => {
    console.error(`   ${i + 1}. ${v.file} → ${v.syntax}`);
  });
  process.exit(1);
}

console.log(`✅ ${files.length} archivo(s) JS en "${root}" sin ?. ni ?? reales detectados.`);
