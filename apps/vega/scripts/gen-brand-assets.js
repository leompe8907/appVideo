#!/usr/bin/env node
/**
 * Prepara las imágenes de la marca del build (VEGA_BRAND, por defecto intv)
 * en assets/brand/ (ignorado por git) para que src/brandAssets.js las empaquete.
 *
 * - Splash y fondo (pantalla completa): JPG de 1920×1080. Se usan los de
 *   assets/brand-source/<marca>/{splash,background}.{jpg,png} si existen
 *   (versionados, hechos para TV); si no, se convierten los de public/<marca>/
 *   de la web con sips (macOS).
 * - Logos y placeholder: PNG de public/<marca>/ (con transparencia). Si falta
 *   alguno se usa el logo, para que el require no falle.
 */
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const brand = process.env.VEGA_BRAND || 'intv';
const webDir = path.resolve(appRoot, '../../public', brand);
const sourceDir = path.join(appRoot, 'assets/brand-source', brand);
const target = path.join(appRoot, 'assets/brand');

const FULL_SCREEN = ['splash', 'background'];
const PNG_FILES = ['logo.png', 'logo-top.png', 'placeholder_220x160.png'];

function firstExisting(candidates) {
  return candidates.find((f) => fs.existsSync(f));
}

function toFullHdJpeg(from, to) {
  if (/\.jpe?g$/i.test(from)) {
    const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', from]).toString();
    if (/pixelWidth: 1920/.test(size) && /pixelHeight: 1080/.test(size)) {
      fs.copyFileSync(from, to);
      return;
    }
  }
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-z', '1080', '1920', from, '--out', to], {
    stdio: 'ignore',
  });
}

if (!fs.existsSync(path.join(webDir, 'logo.png'))) {
  console.error(`gen-brand-assets: no existe ${path.join(webDir, 'logo.png')} (¿VEGA_BRAND=${brand}?)`);
  process.exit(1);
}

fs.rmSync(target, {recursive: true, force: true});
fs.mkdirSync(target, {recursive: true});
const report = [];

for (const name of FULL_SCREEN) {
  const from = firstExisting([
    path.join(sourceDir, `${name}.jpg`),
    path.join(sourceDir, `${name}.png`),
    path.join(webDir, `${name}.png`),
    path.join(webDir, `${name}.jpg`),
  ]);
  if (!from) {
    console.error(`gen-brand-assets: falta ${name} para ${brand}`);
    process.exit(1);
  }
  toFullHdJpeg(from, path.join(target, `${name}.jpg`));
  report.push(`${name} ← ${path.relative(appRoot, from)}`);
}

for (const file of PNG_FILES) {
  const from = firstExisting([path.join(webDir, file)]) || path.join(webDir, 'logo.png');
  fs.copyFileSync(from, path.join(target, file));
  if (!from.endsWith(file)) report.push(`${file} ← logo.png (falta)`);
}

console.log(`assets de ${brand}: ${report.join('; ')}`);
