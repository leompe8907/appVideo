import { execSync } from 'child_process';
import { BRANDS } from '../src/config/brands.js';

execSync('node scripts/check-brand-secrets.js', { stdio: 'inherit' });

console.log('🚀 Iniciando build para todos los clientes...\n');

const brands = BRANDS.map(b => b.brand);
let success = 0;
let failed = 0;

for (const brand of brands) {
  try {
    console.log(`📦 Building ${brand}...`);
    execSync(`cross-env VITE_BRAND=${brand} VITE_DEFAULT_BRAND=${brand} vite build`, {
      stdio: 'inherit',
    });
    execSync(`node scripts/check-es-compat.js dist/${brand}`, { stdio: 'inherit' });
    success++;
    console.log(`✅ ${brand} completado\n`);
  } catch (error) {
    failed++;
    console.error(`❌ ${brand} falló\n`, error?.message || error);
  }
}

console.log(`\n✨ Build completado: ${success} exitosos, ${failed} fallidos`);
process.exit(failed > 0 ? 1 : 0);

