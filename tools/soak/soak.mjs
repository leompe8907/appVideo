#!/usr/bin/env node
/**
 * Prueba de resistencia: recorre la app con el control durante N minutos con
 * una secuencia pseudoaleatoria reproducible (--seed) y cambios de canal
 * periódicos. La sonda (inject-probe.mjs) y el recolector (collector.mjs)
 * registran lo que pasa; este script solo aprieta teclas y se protege de
 * pantallas peligrosas.
 *
 *   node tools/soak/soak.mjs --driver samsung --host 192.168.4.160 --label samsung2020 \
 *     --minutes 120 --seed 42 [--app-id <id>] [--collector http://localhost:8787]
 *   node tools/soak/soak.mjs --driver cdp --host 127.0.0.1 --port 9998 --platform webos ...
 *
 * Seguridad: nunca entra a Mi Cuenta (cerrar cuenta / cerrar sesión) ni al
 * buscador; si la app cae al login, se detiene (perdió la sesión).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { cdpDriver, lgDriver, pageDriver, samsungDriver, sleep } from './drivers.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const driverName = arg('driver');
const host = arg('host');
const label = arg('label', driverName);
const minutes = Number(arg('minutes', 120));
const collector = arg('collector', 'http://localhost:8787');
const relaunch = arg('relaunch'); // comando de shell para relanzar la app (p. ej. `tizen run ...`)
const areas = String(arg('areas', '1,2')).split(',').map(Number);
const tokenDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
let seed = Number(arg('seed', 42)) >>> 0;

// mulberry32: secuencia reproducible con la misma semilla.
function rand() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

const FORBIDDEN = /mi-cuenta|control-parental|buscador/;
const STOP = /^\/login$/; // '/' es el splash: aparece un instante en cada arranque

async function state() {
  try {
    const s = await (await fetch(`${collector}/state`)).json();
    return s[label] || null;
  } catch {
    return null;
  }
}

async function main() {
  if (!driverName || (!host && driverName !== 'page')) throw new Error('faltan --driver y --host');
  const opts = { host, port: arg('port'), platform: arg('platform'), appId: arg('app-id'), tokenDir };
  const driver = driverName === 'page' ? await pageDriver({ collector, label, platform: arg('platform', 'tizen') })
    : driverName === 'cdp' ? await cdpDriver(opts)
    : driverName === 'samsung' ? await samsungDriver(opts)
      : driverName === 'lg' ? await lgDriver(opts) : null;
  if (!driver) throw new Error(`driver desconocido: ${driverName}`);

  const end = Date.now() + minutes * 60000;
  let nextZap = Date.now() + 10 * 60000;
  let presses = 0;
  const press = async (key, gap = between(150, 400)) => {
    await driver.press(key);
    presses++;
    await sleep(gap);
  };

  console.log(`soak ${label}: ${minutes} min, semilla ${arg('seed', 42)}`);
  while (Date.now() < end) {
    const s = await state();
    if (s && Date.now() - s.rx > 45000) {
      console.log(`[${new Date().toISOString()}] sin latido hace ${Math.round((Date.now() - s.rx) / 1000)} s`);
      if (driver.launch) await driver.launch().catch((e) => console.log('relanzar falló:', e.message));
      else if (relaunch) {
        try {
          execSync(relaunch, { stdio: 'ignore', timeout: 60000 });
        } catch (e) {
          console.log('relanzar falló:', e.message);
        }
      }
      await sleep(30000);
      continue;
    }
    // Tras un reinicio, wind pide elegir perfil: se elige el que tiene el foco.
    if (s && s.path === '/profile') {
      console.log(`[${new Date().toISOString()}] en Perfiles: se elige el perfil`);
      await press('ENTER', 15000);
      continue;
    }
    if (s && s.path && STOP.test(s.path.split('?')[0])) {
      console.log(`la app volvió a ${s.path}: se detiene (sesión perdida o reinicio)`);
      break;
    }
    if (s && s.path && FORBIDDEN.test(s.path)) {
      await press('BACK', 1500);
      continue;
    }

    if (Date.now() >= nextZap) {
      // Reproducción: abrir el ítem con foco y cambiar de canal varias veces.
      await press('ENTER', 8000);
      for (let i = 0; i < 5; i++) await press(pick(['CH_UP', 'CH_DOWN']), 8000);
      // Un solo Atrás: dos seguidos en Inicio salen de la app (doble Atrás).
      await press('BACK', 3000);
      nextZap = Date.now() + 10 * 60000;
      continue;
    }

    const r = rand();
    if (r < 0.7) {
      // Navegación dentro del área: ráfaga de flechas en una dirección.
      const dir = pick(['UP', 'DOWN', 'LEFT', 'RIGHT', 'RIGHT', 'DOWN']);
      const n = between(1, 15);
      for (let i = 0; i < n; i++) await press(dir);
    } else if (r < 0.85) {
      // Cambio de área por el menú: al tope y N pasos abajo, solo a las
      // áreas de --areas (por defecto 1 y 2: Inicio y TV y Radio en wind).
      for (let i = 0; i < 4; i++) await press('LEFT', 200);
      for (let i = 0; i < 5; i++) await press('UP', 200);
      for (let i = pick(areas); i > 0; i--) await press('DOWN', 250);
      await press('ENTER', 3000);
    } else if (r < 0.95) {
      await press('ENTER', 2500);
      await press('BACK', 3000);
    } else {
      await sleep(between(3000, 10000)); // pausa: deja ver fugas en reposo
    }
  }
  console.log(`fin: ${presses} teclas`);
  driver.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
