import { describe, expect, it } from 'vitest';
import { detectRestarts, memoryGrowth, percentile, responsiveness, slope, video } from '../metrics';

const MB = 1048576;

describe('percentile', () => {
  it('usa rango más cercano e ignora valores no numéricos', () => {
    expect(percentile([5, 1, 3, null, 2, 4], 50)).toBe(3);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
    expect(percentile([], 95)).toBeNull();
  });
});

describe('slope', () => {
  it('calcula la pendiente de una recta', () => {
    expect(slope([[0, 1], [1, 3], [2, 5]])).toBeCloseTo(2);
    expect(slope([[0, 1]])).toBeNull();
  });
});

describe('detectRestarts', () => {
  it('cuenta recargas y huecos de latido', () => {
    const ev = [
      { t: 'boot', ts: 0 },
      { t: 'hb', ts: 10000 },
      { t: 'hb', ts: 20000 },
      { t: 'boot', ts: 90000 },
      { t: 'hb', ts: 100000 },
    ];
    const r = detectRestarts(ev, { gapMs: 35000 });
    expect(r.reloads).toBe(1);
    expect(r.gaps).toEqual([{ from: 20000, to: 90000, ms: 70000 }]);
  });
});

describe('memoryGrowth', () => {
  it('mide crecimiento desde el minuto indicado', () => {
    const hb = (min, mb) => ({ t: 'hb', ts: min * 60000, heap: { used: mb * MB }, dom: 1000 });
    const r = memoryGrowth([hb(0, 20), hb(10, 40), hb(70, 44), hb(130, 44)], { fromMin: 10 });
    expect(r.enough).toBe(true);
    expect(r.startMB).toBe(40);
    expect(r.growthPct).toBeCloseTo(10);
  });

  it('avisa si no hay muestras suficientes', () => {
    expect(memoryGrowth([{ t: 'hb', ts: 0, heap: { used: MB } }]).enough).toBe(false);
    expect(memoryGrowth([{ t: 'hb', ts: 0, heap: null }])).toBeNull();
  });
});

describe('responsiveness', () => {
  it('separa teclas sin cambio visual y suma frames lentos', () => {
    const r = responsiveness([
      { t: 'key', lat: 50 },
      { t: 'key', lat: 150 },
      { t: 'key', lat: null },
      { t: 'hb', frames: { n: 100, over33: 10, over50: 2 } },
      { t: 'route', sinceKey: 800 },
    ]);
    expect(r.keys).toBe(3);
    expect(r.keysWithoutVisualChange).toBe(1);
    expect(r.p95).toBe(150);
    expect(r.pctFramesOver33).toBe(10);
    expect(r.areaChangeP95).toBe(800);
  });
});

describe('video', () => {
  it('calcula TTFF y porcentaje de rebuffer', () => {
    const r = video([
      { t: 'ttff', ms: 1000 },
      { t: 'ttff', ms: 3000 },
      { t: 'stall', ms: 1000 },
      { t: 'hb', playMs: 99000 },
    ]);
    expect(r.ttffP90).toBe(3000);
    expect(r.rebufferPct).toBeCloseTo(1);
  });
});
