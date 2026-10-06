#!/usr/bin/env node
/**
 * Ajusta manifest.toml y app.json a la marca del build (VEGA_BRAND):
 * id de paquete, título y nombre del componente. Cada marca es una app
 * distinta en el Fire TV / la Appstore.
 *
 *   node scripts/brand-package.js apply     → escribe id/título de la marca
 *   node scripts/brand-package.js restore   → vuelve a los valores de intv
 *
 * intv conserva `com.bromteck.appvideo` (el id con el que ya está instalada);
 * las demás marcas usan `com.bromteck.appvideo.<marca>`. El título sale de
 * `appName` de packages/core/src/config/brands/<marca>.js.
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(appRoot, 'manifest.toml');
const appJsonPath = path.join(appRoot, 'app.json');

const BASE_ID = 'com.bromteck.appvideo';
const DEFAULT_BRAND = 'intv';

function brandInfo(brand) {
  const file = path.resolve(appRoot, '../../packages/core/src/config/brands', `${brand}.js`);
  if (!fs.existsSync(file)) throw new Error(`No existe la marca ${brand} (${file})`);
  const src = fs.readFileSync(file, 'utf8');
  const appName = /"appName":\s*"([^"]+)"/.exec(src)?.[1] || brand;
  const id = brand === DEFAULT_BRAND ? BASE_ID : `${BASE_ID}.${brand.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
  return {id, appName};
}

function write(brand) {
  const {id, appName} = brandInfo(brand);
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest
    .replace(/^title = ".*"$/m, `title = "${appName}"`)
    .replace(/^(\[package\][\s\S]*?\nid = )"[^"]*"/m, `$1"${id}"`)
    .replace(/^(\[\[components\.interactive\]\]\nid = )"[^"]*"/m, `$1"${id}.main"`);
  fs.writeFileSync(manifestPath, manifest);

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  appJson.name = `${id}.main`;
  appJson.displayName = appName;
  fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
  console.log(`paquete: ${id} (${appName})`);
}

const mode = process.argv[2];
if (mode === 'apply') write(process.env.VEGA_BRAND || DEFAULT_BRAND);
else if (mode === 'restore') write(DEFAULT_BRAND);
else {
  console.error('uso: brand-package.js apply|restore');
  process.exit(1);
}
