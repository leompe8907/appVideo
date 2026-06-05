/**
 * Valida que no haya tokens de API hardcodeados en brands.js.
 * Uso: node scripts/check-brand-secrets.js
 * Integrar en CI antes del build de producción.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const brandsPath = join(__dirname, '../src/config/brands.js');

const source = readFileSync(brandsPath, 'utf8');

// token: "" o token: '' están permitidos; literales no vacíos no.
const hardcodedTokenPattern = /token:\s*["']([^"']+)["']/g;

const violations = [];
let match = hardcodedTokenPattern.exec(source);
while (match) {
  const value = match[1].trim();
  if (value.length > 0) {
    violations.push({ value: `${value.slice(0, 4)}…${value.slice(-4)}`, index: match.index });
  }
  match = hardcodedTokenPattern.exec(source);
}

if (violations.length > 0) {
  console.error('❌ Se detectaron tokens hardcodeados en src/config/brands.js:');
  violations.forEach((v, i) => {
    console.error(`   ${i + 1}. token literal en posición ${v.index} (${v.value})`);
  });
  console.error('');
  console.error('   Mueve los tokens a .env.local usando VITE_BRAND_TOKEN_<MARCA>.');
  console.error('   Consulta .env.example para la convención de nombres.');
  process.exit(1);
}

console.log('✅ brands.js: sin tokens hardcodeados.');
