import { createSessionHlsXhrSetup } from './sessionHlsXhrSetup';
import { isWindMiddlewareHost } from './windHlsManifest';

/**
 * Configuración única de hls.js para todo el middleware Panaccess (web).
 *
 * `enableWorker: false` a propósito para TODOS los hosts (antes solo se
 * desactivaba para Wind): un Web Worker que no arranca (bloqueado por CSP,
 * fallo al crear el Blob URL, etc.) falla en silencio — el fetch de
 * segmentos/keys sigue funcionando por XHR en el hilo principal (por eso se
 * ven los `.ts` bajando bien en la pestaña Red), pero el demux/decrypt que
 * corre DENTRO del worker nunca responde y el video se queda "cargando" para
 * siempre sin ningún error visible. Demuxear en el hilo principal es algo
 * más caro de CPU pero muchísimo más confiable en el rango de navegadores/
 * WebViews de 2019 que apunta este proyecto.
 */
export function buildHlsPlaybackConfig(playbackUrl = '', getSessionId) {
  const config = {
    xhrSetup: createSessionHlsXhrSetup(getSessionId),
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    backBufferLength: 30,
    enableWorker: false,
  };

  if (isWindMiddlewareHost(playbackUrl)) {
    Object.assign(config, {
      enableSoftwareAES: true,
      startLevel: 0,
      capLevelToPlayerSize: false,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 6,
      maxBufferLength: 20,
      maxMaxBufferLength: 40,
    });
  }

  return config;
}
