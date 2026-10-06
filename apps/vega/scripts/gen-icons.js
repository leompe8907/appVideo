#!/usr/bin/env node
/**
 * Genera los íconos PNG (blancos, 96×96, transparentes) que usa la app:
 * react-native-svg hace caer la app en el Fire TV Stick, así que los SVG se
 * rasterizan acá y en la app se tiñen con `tintColor`.
 *
 * - Navegación: se leen de src/components/HomeNavIcon.jsx de la web
 *   (misma fuente que la web) → assets/icons/nav-<nombre>.png
 * - Otros: assets/icons/src/*.svg → assets/icons/<nombre>.png
 *
 *   node scripts/gen-icons.js
 */
const fs = require('fs');
const path = require('path');
const {Resvg} = require('@resvg/resvg-js');

const SIZE = 96;
const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, 'assets/icons');

function render(svg, file) {
  const png = new Resvg(svg, {fitTo: {mode: 'width', value: SIZE}, background: 'rgba(0,0,0,0)'}).render().asPng();
  fs.writeFileSync(path.join(outDir, file), png);
}

// 1) Íconos de navegación de la web.
const navSrc = fs.readFileSync(path.resolve(appRoot, '../../src/components/HomeNavIcon.jsx'), 'utf8');
const caseRe = /case '([a-z]+)':([\s\S]*?)(?=case '|default:)/g;
const nav = [];
let m;
while ((m = caseRe.exec(navSrc))) {
  const [, name, body] = m;
  const material = /material\(\s*'([^']+)'/.exec(body);
  const viewBox = material ? '0 -960 960 960' : /viewBox="([^"]+)"/.exec(body)?.[1];
  const paths = material ? [material[1]] : [...body.matchAll(/<path d="([^"]+)"/g)].map((x) => x[1]);
  if (!viewBox || paths.length === 0) continue;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="${viewBox}" fill="#ffffff">${paths
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;
  render(svg, `nav-${name}.png`);
  nav.push(name);
}

// 2) SVG sueltos.
const srcDir = path.join(outDir, 'src');
const others = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter((f) => f.endsWith('.svg')) : [];
for (const f of others) render(fs.readFileSync(path.join(srcDir, f), 'utf8'), f.replace(/\.svg$/, '.png'));

console.log(`íconos: nav (${nav.join(', ')}); otros (${others.join(', ')})`);
