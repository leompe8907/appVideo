#!/usr/bin/env node
/**
 * Copia un build (dist/<marca>) a otra carpeta e inyecta la sonda como primer
 * <script> del <head>. El build original y el código de la app no cambian.
 *
 *   node tools/soak/inject-probe.mjs dist/wind out/wind-probe \
 *     --endpoint http://192.168.4.222:8787/probe --label samsung2020
 *
 * Tizen: el config.xml del paquete necesita <access origin="*" subdomains="true"/>
 * (o el origen del recolector) para que el XHR salga.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

const [src, dest, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const endpoint = opt('endpoint');
const label = opt('label') || 'device';
if (!src || !dest || !endpoint) {
  console.error('uso: inject-probe.mjs <dist> <salida> --endpoint <url> [--label nombre]');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

// webProbe.js no importa nada: basta con quitar el `export` y transpilarlo
// (esbuild llega como dependencia de vite; pnpm no lo expone directo).
const probeSource = fs
  .readFileSync(path.join(root, 'packages/core/src/probe/webProbe.js'), 'utf8')
  .replace(/^export function /m, 'function ');
const { code } = await transformWithEsbuild(
  `(function(){${probeSource}\nstartWebProbe(${JSON.stringify({ endpoint, label })});})();`,
  'perf-probe.js',
  { target: 'chrome53', minify: true, format: 'esm' },
);
fs.writeFileSync(path.join(dest, 'perf-probe.js'), code);

let scripts = '<script src="perf-probe.js"></script>';
// --page-driver: teclas desde el recolector sin modo debug (ver page-driver.js).
if (rest.includes('--page-driver')) {
  const driverSource = fs
    .readFileSync(path.join(root, 'tools/soak/page-driver.js'), 'utf8')
    .replaceAll('__ENDPOINT__', endpoint)
    .replaceAll('__LABEL__', label);
  const driver = await transformWithEsbuild(driverSource, 'perf-driver.js', { target: 'chrome53', minify: true });
  fs.writeFileSync(path.join(dest, 'perf-driver.js'), driver.code);
  scripts += '<script src="perf-driver.js"></script>';
}

const indexPath = path.join(dest, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
if (html.includes('perf-probe.js')) throw new Error('index.html ya tiene la sonda');
fs.writeFileSync(indexPath, html.replace(/<head>/i, `<head>${scripts}`));
console.log(`sonda inyectada en ${dest} (endpoint ${endpoint}, label ${label}${scripts.includes('driver') ? ', con page-driver' : ''})`);
