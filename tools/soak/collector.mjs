#!/usr/bin/env node
/**
 * Recolector de la sonda: recibe POST /probe y guarda un NDJSON por equipo en
 * tools/soak/out/. GET /state devuelve el último latido de cada equipo (lo usa
 * soak.mjs para saber si la app sigue viva y en qué ruta está).
 *
 *   node tools/soak/collector.mjs [--port 8787]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 8787;
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(outDir, { recursive: true });

const debug = args.includes('--debug');
const day = new Date().toISOString().slice(0, 10);
const last = {};
// Cola de teclas para page-driver.js: POST /cmd encola, GET /cmd (long-poll) entrega.
const queues = {};
const waiters = {};

function deliver(label) {
  const w = waiters[label];
  const q = queues[label];
  if (!w || !q || !q.length) return;
  delete waiters[label];
  clearTimeout(w.timer);
  const keys = q.splice(0);
  if (debug) console.log(new Date().toISOString(), 'entrega', label, keys.map((k) => k.code).join(','), 'socket abierto:', !w.res.socket.destroyed);
  w.res.setHeader('Content-Type', 'application/json');
  w.res.end(JSON.stringify(keys));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.end();
  if (req.method === 'GET' && req.url === '/state') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(last));
  }
  if (req.url.startsWith('/cmd')) {
    const label = new URL(req.url, 'http://x').searchParams.get('label') || 'device';
    if (req.method === 'GET') {
      if (debug) console.log(new Date().toISOString(), 'poll', label, req.socket.remoteAddress);
      if (waiters[label]) {
        clearTimeout(waiters[label].timer);
        waiters[label].res.end('[]');
      }
      waiters[label] = {
        res,
        timer: setTimeout(() => {
          if (waiters[label] && waiters[label].res === res) delete waiters[label];
          res.end('[]');
        }, 25000),
      };
      return deliver(label);
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        (queues[label] = queues[label] || []).push(...JSON.parse(body));
        deliver(label);
        res.statusCode = 204;
      } catch {
        res.statusCode = 400;
      }
      res.end();
    });
    return;
  }
  if (req.method !== 'POST' || req.url !== '/probe') {
    res.statusCode = 404;
    return res.end();
  }
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 2e6) req.destroy();
  });
  req.on('end', () => {
    try {
      const batch = JSON.parse(body);
      const label = String(batch.label || 'device').replace(/[^\w.-]/g, '_');
      const file = path.join(outDir, `${label}-${day}.ndjson`);
      const lines = batch.events.map((e) => JSON.stringify({ ...e, pageId: batch.pageId, rx: Date.now() })).join('\n');
      fs.appendFileSync(file, lines + '\n');
      const hb = [...batch.events].reverse().find((e) => e.t === 'hb' || e.t === 'boot' || e.t === 'route');
      // Un lote sin latido ni ruta (por ejemplo, solo teclas) conserva la ruta conocida.
      const prev = last[label] && last[label].pageId === batch.pageId ? last[label] : {};
      last[label] = {
        rx: Date.now(),
        pageId: batch.pageId,
        path: hb ? hb.path : prev.path,
        hidden: hb && hb.hidden != null ? hb.hidden : prev.hidden,
      };
      res.statusCode = 204;
    } catch {
      res.statusCode = 400;
    }
    res.end();
  });
}).listen(port, '0.0.0.0', () => console.log(`collector en :${port} → ${outDir}`));
