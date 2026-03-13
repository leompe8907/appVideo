import { WebEngine } from './web/WebEngine';

/**
 * Fábrica de engines de reproducción.
 * Por ahora solo hay WebEngine (HTML5 video).
 * En el futuro se pueden añadir TizenEngine / WebOSEngine según la plataforma.
 */
export function createEngine(deviceInfo) {
  // TODO: cuando se implementen engines nativos:
  // if (deviceInfo?.platform === 'tizen') return new TizenEngine();
  // if (deviceInfo?.platform === 'webos') return new WebOSEngine();

  return new WebEngine();
}

