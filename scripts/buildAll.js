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
    // Antes llamaba a check-es-compat.js directo, que solo VERIFICA (no corrige)
    // sintaxis ES incompatible — se saltaba la retranspilación Babel de chunks
    // *-legacy* que sí corre en el flujo por marca (`postbuild:<brand>` →
    // postbuild-es-check.js → babelLegacyDist). Con eso, `build:all` daba menos
    // garantía de compatibilidad ES5 que `build:telecable` etc. para el MISMO
    // código. postbuild-es-check.js hace retranspilación + verificación, igual
    // que el flujo individual.
    execSync(`node scripts/postbuild-es-check.js ${brand}`, { stdio: 'inherit' });
    success++;
    console.log(`✅ ${brand} completado\n`);
  } catch (error) {
    failed++;
    console.error(`❌ ${brand} falló\n`, error?.message || error);
  }
}

console.log(`\n✨ Build completado: ${success} exitosos, ${failed} fallidos`);
process.exit(failed > 0 ? 1 : 0);

