export const PLAYER_ENGINE_EVENTS = Object.freeze({
  STATE_CHANGE: 'statechange',
  TIME_UPDATE: 'timeupdate',
  DURATION_CHANGE: 'durationchange',
  ENDED: 'ended',
  ERROR: 'error',
  SEEK_START: 'seek-start',
  SEEK_END: 'seek-end',
  TRACKS_CHANGE: 'trackschange',
});

export const PLAYER_ENGINE_STATES = Object.freeze({
  LOADING: 'loading',
  LOADED: 'loaded',
  PLAYING: 'playing',
  PAUSED: 'paused',
  SEEKING: 'seeking',
  SEEKED: 'seeked',
  ENDED: 'ended',
});

export const DEFAULT_SEEK_STEP_SECONDS = 20;
export const DEFAULT_TIMEUPDATE_THROTTLE_MS = 250;

