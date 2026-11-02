import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Chromium < 84 (LG webOS 5, Samsung antiguos) ignora `gap` en flexbox y deja
 * los hijos pegados. Las reglas con `display: flex` deben usar los mixins
 * `flex-gap-row` / `flex-gap-column` / `flex-gap-wrap` de `styles/_mixins.scss`.
 * (`gap` en `display: grid` sí funciona desde Chromium 66.)
 */
function scssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : scssFiles(full);
    return entry.name.endsWith('.scss') ? [full] : [];
  });
}

describe('estilos sin gap en flexbox', () => {
  it('ninguna regla combina display:flex con gap distinto de 0', () => {
    const offenders = [];
    for (const file of scssFiles('src')) {
      const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, selector, body] of css.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
        const isFlex = /display:\s*(inline-)?flex/.test(body);
        const gap = body.match(/(?<![-\w])gap:\s*([^;]+);/);
        if (isFlex && gap && !/^0(px|rem)?$/.test(gap[1].trim())) {
          offenders.push(`${file}: ${selector.trim().split('\n').pop().trim()} (gap: ${gap[1].trim()})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
