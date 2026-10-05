import { describe, it, expect } from 'vitest';
import bromteck from '../brands/bromteck.js';
import cableatlantico from '../brands/cableatlantico.js';
import defaults from '../brands/defaults.js';
import gigmax from '../brands/gigmax.js';
import intv from '../brands/intv.js';
import multiplustv from '../brands/multiplustv.js';
import sattv from '../brands/sattv.js';
import wind from '../brands/wind.js';

/**
 * Todas las marcas deben tener el mismo conjunto de parámetros (ver el
 * comentario de `brands/defaults.js`). Este test falla si una marca nueva o
 * un parámetro nuevo queda en algunas marcas y no en otras.
 */
const BRANDS = { bromteck, cableatlantico, defaults, gigmax, intv, multiplustv, sattv, wind };

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    isPlainObject(v) ? [`${prefix}${k}`, ...flatKeys(v, `${prefix}${k}.`)] : [`${prefix}${k}`],
  );
}

describe('paridad de parámetros entre marcas', () => {
  const sets = Object.fromEntries(Object.entries(BRANDS).map(([n, c]) => [n, new Set(flatKeys(c))]));
  const all = new Set(Object.values(sets).flatMap((s) => [...s]));

  it.each(Object.keys(BRANDS))('%s tiene todos los parámetros', (name) => {
    const missing = [...all].filter((k) => !sets[name].has(k));
    expect(missing).toEqual([]);
  });

  it('el casteo viene apagado en todas las marcas', () => {
    for (const [name, c] of Object.entries(BRANDS)) {
      expect(c.features.castEnabled, name).toBe(false);
    }
  });
});
