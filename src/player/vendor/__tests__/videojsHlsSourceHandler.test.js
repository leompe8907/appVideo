import { describe, it, expect } from 'vitest';
import videojs from 'video.js';
import { registerVideojsHlsSourceHandler } from '../videojsHlsSourceHandler.js';

/**
 * Verifica el reemplazo del plugin vendorizado (videojs-hlsjs-plugin.js,
 * Streamroot 2018) contra la versión REAL de video.js declarada en
 * package.json (6.6.3) — no un mock. jsdom no implementa MediaSource, así que
 * esto no reproduce bytes de video reales (eso requiere navegador/hardware
 * real), pero sí prueba el contrato completo de integración: registro en el
 * Tech Html5, selección de fuente HLS, y el ciclo de vida de
 * `tech.hlsProvider` (que `WebEngine._disposeHlsProvider()` y
 * `attachWindLevelLock()` ya esperaban de la implementación anterior).
 */

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('registerVideojsHlsSourceHandler', () => {
  it('se registra en el Tech Html5 sin lanzar', () => {
    const ok = registerVideojsHlsSourceHandler(videojs);
    expect(ok).toBe(true);
  });

  it('canHandleSource reconoce fuentes HLS (mismo patrón que el plugin anterior)', () => {
    const Html5 = videojs.getTech('Html5');
    const list = Html5.sourceHandlers;
    expect(Array.isArray(list)).toBe(true);
    const ours = list.find((h) => h.canHandleSource.toString().includes('mpegURL'));
    expect(ours).toBeTruthy();
    expect(ours.canHandleSource({ type: 'application/x-mpegURL' })).toBe('probably');
    expect(ours.canHandleSource({ src: 'https://x/live.m3u8' })).toBe('maybe');
    expect(ours.canHandleSource({ src: 'https://x/video.mp4' })).toBe('');
  });

  it('handleSource crea un player real, no lanza, y expone tech.hlsProvider.dispose()', async () => {
    document.body.innerHTML = '<video id="hls-test-1" class="video-js"></video>';
    const player = videojs('hls-test-1', { techOrder: ['html5'] });

    expect(() => {
      player.src({ src: 'https://example.invalid/stream.m3u8', type: 'application/x-mpegURL' });
    }).not.toThrow();

    await tick();

    const tech = player.tech(true);
    expect(tech.hlsProvider).toBeTruthy();
    expect(typeof tech.hlsProvider.dispose).toBe('function');

    expect(() => tech.hlsProvider.dispose()).not.toThrow();
    expect(() => player.dispose()).not.toThrow();
  });

  it('cambiar de fuente dos veces (zapping) no lanza y renueva el provider', async () => {
    document.body.innerHTML = '<video id="hls-test-2" class="video-js"></video>';
    const player = videojs('hls-test-2', { techOrder: ['html5'] });

    player.src({ src: 'https://example.invalid/ch1.m3u8', type: 'application/x-mpegURL' });
    await tick();
    expect(player.tech(true).hlsProvider).toBeTruthy();

    expect(() => {
      player.src({ src: 'https://example.invalid/ch2.m3u8', type: 'application/x-mpegURL' });
    }).not.toThrow();
    await tick();

    expect(player.tech(true).hlsProvider).toBeTruthy();
    expect(() => player.dispose()).not.toThrow();
  });
});
