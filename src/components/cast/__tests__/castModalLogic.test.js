import { describe, it, expect } from 'vitest';
import { buildCastContent, castErrorKey, pickSendTargets } from '../castModalLogic';

describe('pickSendTargets', () => {
  it('deja solo dispositivos en línea y distintos del propio', () => {
    const list = [
      { id: 1, online: true, is_self: true },
      { id: 2, online: false },
      { id: 3, online: true },
      { id: 4, online: true, can_receive: false },
      null,
    ];
    expect(pickSendTargets(list).map((d) => d.id)).toEqual([3]);
  });

  it('tolera valores inválidos', () => {
    expect(pickSendTargets(null)).toEqual([]);
    expect(pickSendTargets(undefined)).toEqual([]);
  });
});

describe('castErrorKey', () => {
  it('mapea códigos conocidos y cae a genérico', () => {
    expect(castErrorKey('target_offline').key).toBe('cast.errors.targetOffline');
    expect(castErrorKey('cast_timeout').key).toBe('cast.errors.timeout');
    expect(castErrorKey('algo_nuevo').key).toBe('cast.errors.generic');
    expect(castErrorKey(undefined).key).toBe('cast.errors.generic');
  });
});

describe('buildCastContent', () => {
  it('sin reproducción o sin id no hay nada que transmitir', () => {
    expect(buildCastContent(null)).toBeNull();
    expect(buildCastContent({ type: 'vod', id: 1 })).toBeNull();
    expect(buildCastContent({ type: 'vod', url: 'u' })).toBeNull();
    expect(buildCastContent({ type: 'ad', id: 1, url: 'u' })).toBeNull();
  });

  it('canal en vivo: sin posición', () => {
    expect(buildCastContent({ type: 'service', id: 7, url: 'u', currentTime: 500, item: { name: 'Canal' } })).toEqual({
      kind: 'service',
      id: 7,
      title: 'Canal',
    });
  });

  it('vod/catchup: lleva la posición actual para continuar donde iba', () => {
    expect(buildCastContent({ type: 'vod', id: 9, url: 'u', currentTime: 120.5, item: { title: 'Peli' } })).toEqual({
      kind: 'vod',
      id: 9,
      title: 'Peli',
      startPositionSeconds: 120.5,
    });
    expect(buildCastContent({ type: 'catchup', id: 2, url: 'u', currentTime: 0 })).toEqual({ kind: 'catchup', id: 2 });
  });

  it('nunca incluye la URL (lleva la sesión de PanAccess)', () => {
    const c = buildCastContent({ type: 'vod', id: 1, url: 'http://x?sessionId=SECRETO', currentTime: 1 });
    expect(JSON.stringify(c)).not.toContain('SECRETO');
  });
});
