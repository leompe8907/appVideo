/**
 * Piezas puras del PlayerContext para que solo se re-dibuje quien necesita el
 * tiempo de reproducción. `handleTime` actualiza `state` ~4 veces por segundo y,
 * con un solo contexto, eso re-dibujaba todo Inicio (cientos de tarjetas) debajo
 * del player y dejaba el hilo principal al ~100 % en el TV.
 */

/** Campos de `state` que cambian con cada `timeupdate`. */
export const PLAYER_TIME_KEYS = [
  'currentTime',
  'duration',
  'liveSecondsLate',
  'liveInitialPlayerTime',
  'liveInitialServerMs',
];

/** Acciones que se exponen con identidad estable (nunca cambian entre renders). */
export const PLAYER_ACTION_KEYS = [
  'play',
  'retry',
  'pause',
  'stop',
  'close',
  'seek',
  'forward',
  'backward',
  'setPlaybackRate',
  'skipLiveBy',
  'goLive',
  'mute',
  'unmute',
  'toggleMute',
  'setVolume',
  'getVideoElement',
  'getDiagnostics',
  'refreshTracks',
  'selectAudioTrack',
  'selectTextTrack',
  'setSubtitlesEnabled',
  'confirmLicenseInUse',
];

/** `state` sin los campos de tiempo. */
export function omitTimeFields(state) {
  const rest = { ...state };
  for (const key of PLAYER_TIME_KEYS) delete rest[key];
  return rest;
}

export function shallowEqual(a, b) {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
}

/**
 * Devuelve `next` solo si difiere (shallow) de `prev`; si no, `prev` (misma
 * referencia, así un `useMemo`/contexto que dependa de él no se invalida).
 */
export function keepIfShallowEqual(prev, next) {
  return prev && shallowEqual(prev, next) ? prev : next;
}

/**
 * Objeto de acciones con identidad estable: cada función delega en la versión
 * más reciente guardada en `latestRef.current` (las originales se recrean en
 * cada render porque cierran sobre `state`).
 */
export function createStableActions(latestRef, keys = PLAYER_ACTION_KEYS) {
  const actions = {};
  for (const key of keys) {
    actions[key] = (...args) => latestRef.current?.[key]?.(...args);
  }
  return actions;
}
