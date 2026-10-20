import { describe, it, expect } from 'vitest';
import {
  formatInactivityCountdown,
  resolveInactivityGraceSec,
  resolveInactivityPhase,
  resolveInactivityTimeoutSec,
} from '../inactivityConfig';

describe('resolveInactivityTimeoutSec', () => {
  it('usa X_INACTIVITY_TIMEOUT_SEC del clientConfig (con o sin answer)', () => {
    const cfg = { answer: { device: { parameters: { X_INACTIVITY_TIMEOUT_SEC: '14400' } } } };
    expect(resolveInactivityTimeoutSec(cfg, null)).toBe(14400);
    expect(resolveInactivityTimeoutSec(cfg.answer, null)).toBe(14400);
  });

  it('sin dato del cliente cae al default de la marca, y si no hay, 0 (apagado)', () => {
    expect(resolveInactivityTimeoutSec(null, { player: { defaultInactivityTimeoutSec: 3600 } })).toBe(3600);
    expect(resolveInactivityTimeoutSec(null, {})).toBe(0);
  });
});

describe('resolveInactivityGraceSec', () => {
  it('usa el del cliente si es >= 10, si no el de la marca, si no 60', () => {
    expect(resolveInactivityGraceSec({ device: { parameters: { X_INACTIVITY_GRACE_SEC: 30 } } }, null)).toBe(30);
    expect(resolveInactivityGraceSec({ device: { parameters: { X_INACTIVITY_GRACE_SEC: 5 } } }, { player: { inactivityGraceSec: 45 } })).toBe(45);
    expect(resolveInactivityGraceSec(null, null)).toBe(60);
  });
});

describe('resolveInactivityPhase', () => {
  const base = { lastInteractionAtMs: 0, timeoutSec: 100, graceSec: 60 };

  it('antes del tiempo de inactividad: activo', () => {
    expect(resolveInactivityPhase({ ...base, nowMs: 99_000 })).toEqual({ phase: 'active', secondsLeft: 60 });
  });

  it('pasado el tiempo: aviso con la cuenta regresiva', () => {
    expect(resolveInactivityPhase({ ...base, nowMs: 100_000 })).toEqual({ phase: 'warning', secondsLeft: 60 });
    expect(resolveInactivityPhase({ ...base, nowMs: 130_500 })).toEqual({ phase: 'warning', secondsLeft: 30 });
  });

  it('terminada la cuenta regresiva: vencido', () => {
    expect(resolveInactivityPhase({ ...base, nowMs: 160_000 })).toEqual({ phase: 'expired', secondsLeft: 0 });
  });

  it('con timeout 0 (apagado) siempre activo', () => {
    expect(resolveInactivityPhase({ ...base, timeoutSec: 0, nowMs: 10_000_000 }).phase).toBe('active');
  });
});

describe('formatInactivityCountdown', () => {
  it('mm:ss', () => {
    expect(formatInactivityCountdown(65)).toBe('01:05');
    expect(formatInactivityCountdown(-3)).toBe('00:00');
  });
});
