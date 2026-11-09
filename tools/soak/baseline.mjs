#!/usr/bin/env node
/**
 * Línea base por pantalla (PERF-02/04/05/06 y PLAY-14/15 del plan de pruebas):
 * recorre fases fijas con el driver de página (sin modo debug), guarda la
 * ventana de tiempo de cada fase y saca las métricas de la sonda por fase.
 *
 *   node tools/soak/baseline.mjs --label samsung2020 [--platform tizen] [--rounds 1]
 *
 * Supone la app en Inicio (marca wind: menú lateral Inicio / TV y Radio /
 * Buscador). Requiere el recolector y la copia con --page-driver.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageDriver, sleep } from './drivers.mjs';
import { percentile, responsiveness, video } from '../../packages/core/src/probe/metrics.js';

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const label = arg('label', 'samsung2020');
const collector = arg('collector', 'http://localhost:8787');
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const d = await pageDriver({ collector, label, platform: arg('platform', 'tizen') });

const GAP = 700; // ritmo humano: ~1,4 teclas por segundo
async function keys(seq, gap = GAP) {
  for (const k of seq) {
    await d.press(k);
    await sleep(gap);
  }
}
const rep = (k, n) => Array(n).fill(k);

async function currentPath() {
  const s = await (await fetch(`${collector}/state`)).json();
  return s[label] ? s[label].path : null;
}

async function waitPath(re, ms = 12000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const p = await currentPath();
    if (p && re.test(p)) return p;
    await sleep(500);
  }
  return currentPath();
}

// Orden del menú lateral en wind: avatar (Mi Cuenta), Inicio, TV y Radio, Buscador.
const SIDEBAR = { inicio: 1, 'servicios-tv-radio': 2 };
// Pantallas donde el recorrido nunca debe quedarse (cuenta, cierre de sesión, teclado).
const FORBIDDEN = /mi-cuenta|buscador|login|profile/;

/** Va a un área por el menú: sube hasta el tope y baja N pasos; verifica la ruta. */
async function goTo(area) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = (await currentPath()) || '';
    if (p.endsWith(`/${area}`)) return;
    if (FORBIDDEN.test(p)) await keys(['BACK'], 1500);
    await keys(['LEFT', 'LEFT', 'LEFT', ...rep('UP', 5), ...rep('DOWN', SIDEBAR[area])], 300);
    await keys(['ENTER'], 1000);
    const now = await waitPath(new RegExp(`/${area}$`));
    if (now && now.endsWith(`/${area}`)) {
      await sleep(3000);
      return;
    }
    console.log(`  goTo(${area}) intento ${attempt + 1}: quedó en ${now}`);
  }
  throw new Error(`no se pudo llegar a ${area}`);
}

const phases = [];
async function phase(name, area, fn) {
  await goTo(area);
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${name}`);
  await fn();
  const p = (await currentPath()) || '';
  const valid = !FORBIDDEN.test(p);
  if (!valid) console.log(`  ${name}: terminó en ${p}, fase inválida`);
  phases.push({ name, area, start, end: Date.now(), valid, endPath: p });
}

await phase('inicio-filas', 'inicio', async () => {
  await keys(['RIGHT', 'DOWN']);
  await keys([...rep('RIGHT', 15), 'DOWN', 'DOWN', ...rep('RIGHT', 10), ...rep('LEFT', 10), 'UP', 'UP', 'UP']);
});
await phase('rafaga-inicio', 'inicio', async () => {
  await keys(['RIGHT', 'DOWN']);
  await keys(rep('RIGHT', 20), 120);
  await keys(rep('LEFT', 20), 120);
});
await phase('cambio-area', 'inicio', async () => {
  for (let i = 0; i < 3; i++) {
    await goTo('servicios-tv-radio');
    await goTo('inicio');
  }
});
await phase('tv-radio', 'servicios-tv-radio', async () => {
  await keys(['RIGHT', ...rep('RIGHT', 15), ...rep('DOWN', 5), ...rep('UP', 5), ...rep('LEFT', 10)]);
});
await phase('player-zapping', 'inicio', async () => {
  await keys(['RIGHT', 'DOWN']);
  await keys(['ENTER'], 15000);
  for (let i = 0; i < 5; i++) await keys(['CH_UP'], 10000);
  await keys(['BACK'], 3000);
});
await phase('player-abrir-cerrar', 'inicio', async () => {
  await keys(['RIGHT', 'DOWN']);
  for (let i = 0; i < 5; i++) {
    await keys(['ENTER'], 8000);
    await keys(['BACK'], 3000);
  }
});

await sleep(12000); // último flush de la sonda
const file = path.join(outDir, `${label}-${new Date().toISOString().slice(0, 10)}.ndjson`);
const all = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const result = phases.map((p) => {
  if (!p.valid) return { fase: `${p.name} (INVÁLIDA: ${p.endPath})` };
  const ev = all.filter((e) => e.ts >= p.start && e.ts <= p.end + 1500);
  const r = responsiveness(ev);
  const v = video(ev);
  const hb = ev.filter((e) => e.t === 'hb');
  const closes = ev.filter((e) => e.t === 'key' && e.code === 10009).map((e) => e.lat);
  return {
    fase: p.name,
    teclas: r.keys,
    sinCambio: r.keysWithoutVisualChange,
    p50: r.p50,
    p95: r.p95,
    max: r.max,
    framesLentosPct: r.pctFramesOver33 == null ? null : Number(r.pctFramesOver33.toFixed(1)),
    tareasLargas: r.longTasks,
    tareaLargaMax: r.longTaskMax,
    cambioAreaP95: r.areaChangeP95,
    ttffP50: v.ttffP50,
    ttffP90: v.ttffP90,
    inicios: v.starts,
    atrasP50: percentile(closes, 50),
    errores: ev.filter((e) => e.t === 'error').map((e) => e.msg).slice(0, 3),
    domMax: Math.max(0, ...hb.map((e) => e.dom || 0)),
    videosMax: Math.max(0, ...hb.map((e) => e.videos || 0)),
  };
});
const out = path.join(outDir, `baseline-${label}-${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify({ phases, result }, null, 2));
console.table(result.map(({ errores, ...rest }) => ({ ...rest, errores: errores.length })));
console.log(`detalle: ${out}`);
