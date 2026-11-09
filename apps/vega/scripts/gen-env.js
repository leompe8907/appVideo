#!/usr/bin/env node
/**
 * Genera src/env.generated.js (ignorado por git).
 *
 * DEV_STORAGE_SEED: claves de almacenamiento a precargar en builds de
 * desarrollo, leídas de `dev-session.local.json` si existe, p. ej.
 *   { "intv.sessionId": "U2Fsd...", "intv.udid": "WEB-...", "intv.username": "U2Fsd..." }
 * (los mismos valores que la web guarda en localStorage).
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const seedFile = path.join(appRoot, 'dev-session.local.json');
let seed = {};
if (fs.existsSync(seedFile)) {
  seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
}

const out = `// Generado por scripts/gen-env.js. No editar ni commitear.
export const DEV_STORAGE_SEED = ${JSON.stringify(seed, null, 2)};
`;
fs.writeFileSync(path.join(appRoot, 'src/env.generated.js'), out);
console.log(`env.generated.js: ${Object.keys(seed).length} clave(s) de sesión de desarrollo`);
