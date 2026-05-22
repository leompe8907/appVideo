import { createSessionHlsXhrSetup } from './sessionHlsXhr';
import { isWindMiddlewareHost } from './windHlsManifest';

/**
 * Configuración única de hls.js para todo el middleware Panaccess (web).
 */
export function buildHlsPlaybackConfig(playbackUrl = '', getSessionId) {
  const config = {
    xhrSetup: createSessionHlsXhrSetup(getSessionId),
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    backBufferLength: 30,
    enableWorker: true,
  };

  if (isWindMiddlewareHost(playbackUrl)) {
    Object.assign(config, {
      enableWorker: false,
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
