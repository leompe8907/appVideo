import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDateTimeFormatter } from '../intlFormat.js';
import { fmtCatchupDate } from '../catchupEvent.js';

const OPTS = { day: '2-digit', month: 'short', year: 'numeric' };

describe('getDateTimeFormatter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reutiliza el formateador para el mismo idioma y opciones', () => {
    const a = getDateTimeFormatter('es', OPTS);
    expect(getDateTimeFormatter('es', { ...OPTS })).toBe(a);
    expect(getDateTimeFormatter('en', OPTS)).not.toBe(a);
    expect(getDateTimeFormatter('es', { month: 'long' })).not.toBe(a);
  });

  it('da lo mismo que toLocaleDateString', () => {
    const d = new Date(Date.UTC(2026, 9, 29, 12));
    expect(getDateTimeFormatter('es', OPTS).format(d)).toBe(d.toLocaleDateString('es', OPTS));
  });
});

describe('fmtCatchupDate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no usa toLocaleDateString (que crea un formateador nuevo en cada llamada)', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    for (let i = 0; i < 400; i += 1) fmtCatchupDate(Date.UTC(2026, 0, 1 + (i % 28)), 'fr');
    expect(spy).not.toHaveBeenCalled();
  });

  it('mantiene el resultado y devuelve vacío con fecha o idioma inválidos', () => {
    const ms = Date.UTC(2026, 9, 29, 12);
    expect(fmtCatchupDate(ms, 'es')).toBe(new Date(ms).toLocaleDateString('es', OPTS));
    expect(fmtCatchupDate(null, 'es')).toBe('');
    expect(fmtCatchupDate(Number.NaN, 'es')).toBe('');
    expect(fmtCatchupDate(ms, 'no-es-un-idioma-valido!!')).toBe('');
  });
});
