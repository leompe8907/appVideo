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
    // Colchón de buffer en vivo: antes solo se aplicaba a hosts de Wind
    // (middleware.wind.do). Se generaliza a TODOS los operadores porque el
    // stall (`bufferStalledError`, no fatal, hls.js recupera solo) se
    // reprodujo igual con un operador distinto (multiplustv, cv10.panaccess.
    // com) apenas arranca un canal en vivo cuya playlist trae una ventana
    // corta (`LEVEL_LOADED fragCount: 5` en el ejemplo real) -- con pocos
    // segmentos disponibles, arrancar muy pegado al borde en vivo deja poco
    // margen antes de alcanzarlo, y cualquier mínima demora de red hace que
    // la reproducción se quede sin buffer un instante. `liveMaxLatencyDurationCount`
    // en particular no tenía valor propio antes de este cambio (default de
    // hls.js: Infinity, sin lógica de resync) para ningún operador que no
    // fuera Wind.
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 6,
  };

  if (isWindMiddlewareHost(playbackUrl)) {
    Object.assign(config, {
      enableSoftwareAES: true,
      startLevel: 0,
      capLevelToPlayerSize: false,
      maxBufferLength: 20,
      maxMaxBufferLength: 40,
    });
  }

  return config;
}
