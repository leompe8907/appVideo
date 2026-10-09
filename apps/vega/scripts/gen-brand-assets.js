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
  const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', from]).toString();
  const w = Number((size.match(/pixelWidth: (\d+)/) || [])[1]);
  const h = Number((size.match(/pixelHeight: (\d+)/) || [])[1]);
  if (/\.jpe?g$/i.test(from) && w === 1920 && h === 1080) {
    fs.copyFileSync(from, to);
    return;
  }
  // Si no es 16:9 se recorta al centro antes de escalar (si no, se deforma).
  let src = from;
  if (w && h && Math.abs(w / h - 16 / 9) > 0.01) {
    const cropW = Math.min(w, Math.round((h * 16) / 9));
    const cropH = Math.min(h, Math.round((w * 9) / 16));
    src = `${to}.crop.png`;
    execFileSync('sips', ['-s', 'format', 'png', '-c', String(cropH), String(cropW), from, '--out', src], {stdio: 'ignore'});
  }
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-z', '1080', '1920', src, '--out', to], {
    stdio: 'ignore',
  });
  if (src !== from) fs.rmSync(src, {force: true});
}

/** `login.backgroundImage` de la marca ({enabled, assetPath}) leído del archivo de marca. */
function loginBackgroundAsset() {
  const file = path.resolve(appRoot, '../../packages/core/src/config/brands', `${brand}.js`);
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(/"backgroundImage":\s*\{\s*"enabled":\s*(true|false),\s*"assetPath":\s*"([^"]*)"/);
  return m && m[1] === 'true' && m[2] ? m[2] : null;
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

// Fondo del login: `login.backgroundImage.assetPath` si la marca lo activa
// (Wind: backgroundalt.webp), si no el fondo general (como LoginPage de la web).
{
  const asset = loginBackgroundAsset();
  const from = asset ? firstExisting([path.join(sourceDir, `login-background.jpg`), path.join(webDir, asset)]) : null;
  if (from) {
    toFullHdJpeg(from, path.join(target, 'login-background.jpg'));
    report.push(`login-background ← ${path.relative(appRoot, from)}`);
  } else {
    fs.copyFileSync(path.join(target, 'background.jpg'), path.join(target, 'login-background.jpg'));
  }
}

for (const file of PNG_FILES) {
  const from = firstExisting([path.join(webDir, file)]) || path.join(webDir, 'logo.png');
  fs.copyFileSync(from, path.join(target, file));
  if (!from.endsWith(file)) report.push(`${file} ← logo.png (falta)`);
}

console.log(`assets de ${brand}: ${report.join('; ')}`);
