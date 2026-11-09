#!/usr/bin/env node
/**
 * Resume un NDJSON del recolector contra los 5 criterios de la Fase 0.
 *
 *   node tools/soak/report.mjs tools/soak/out/samsung2020-2026-11-02.ndjson
 */
import fs from 'node:fs';
import { detectRestarts, memoryGrowth, responsiveness, startup, video } from '../../packages/core/src/probe/metrics.js';

const file = process.argv[2];
if (!file) {
  console.error('uso: report.mjs <archivo.ndjson>');
  process.exit(1);
}
// --since <epoch ms>: solo los eventos de una corrida (el NDJSON es por día).
const sinceIdx = process.argv.indexOf('--since');
const since = sinceIdx > 0 ? Number(process.argv[sinceIdx + 1]) : 0;
const events = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((e) => e.ts >= since).sort((a, b) => a.ts - b.ts);
const durMin = events.length ? (events[events.length - 1].ts - events[0].ts) / 60000 : 0;
const r = {
  durationMin: Math.round(durMin),
  stability: { ...detectRestarts(events), errors: events.filter((e) => e.t === 'error').length },
  memory: memoryGrowth(events),
  response: responsiveness(events),
  video: video(events),
  startup: startup(events),
};

const fmt = (v, d = 0) => (v == null ? 's/d' : Number(v).toFixed(d));
const ok = (cond) => (cond == null ? 'SIN DATOS' : cond ? 'CUMPLE' : 'NO CUMPLE');
const m = r.memory || {};
console.log(`# Resultado ${file} (${r.durationMin} min)\n`);
console.log('| Criterio | Medido | Umbral | Estado |');
console.log('|---|---|---|---|');
console.log(`| 1 Estabilidad | ${r.stability.reloads} recargas, ${r.stability.gaps.length} cortes de latido, ${r.stability.errors} errores JS | 0 recargas y 0 cortes en 120 min | ${ok(durMin >= 120 ? r.stability.reloads === 0 && r.stability.gaps.length === 0 : null)} |`);
console.log(`| 2 Memoria | heap ${fmt(m.startMB, 1)}→${fmt(m.endMB, 1)} MB (${fmt(m.growthPct, 1)} %, ${fmt(m.mbPerHour, 1)} MB/h), DOM máx ${fmt(m.domNodesMax)} | < 10 % entre min 10 y fin | ${ok(m.enough ? m.growthPct < 10 : null)} |`);
console.log(`| 3 Respuesta | tecla p50 ${fmt(r.response.p50)} / p95 ${fmt(r.response.p95)} ms; frames > 33 ms ${fmt(r.response.pctFramesOver33, 1)} %; cambio de área p95 ${fmt(r.response.areaChangeP95)} ms | p95 < 100 ms; frames > 33 ms < 5 % | ${ok(r.response.p95 == null ? null : r.response.p95 < 100 && (r.response.pctFramesOver33 ?? 100) < 5)} |`);
console.log(`| 4 Video | TTFF p50 ${fmt(r.video.ttffP50)} / p90 ${fmt(r.video.ttffP90)} ms (${r.video.starts} inicios); rebuffer ${fmt(r.video.rebufferPct, 2)} % | TTFF p90 < 2500 ms; rebuffer < 1 % | ${ok(r.video.ttffP90 == null ? null : r.video.ttffP90 < 2500 && (r.video.rebufferPct ?? 0) < 1)} |`);
console.log(`| 5 Arranque | primer foco a ${fmt(r.startup.first)} ms | < 5000 ms | ${ok(r.startup.first == null ? null : r.startup.first < 5000)} |`);
console.log('\n```json\n' + JSON.stringify(r, null, 2) + '\n```');
