/**
 * Layout del HUD del reproductor por zona.
 * Orden del array = orden visual (izquierda → derecha).
 *
 * Personalizar por marca en `player.hudLayout` (solo las zonas que cambien).
 * Claves válidas: valores de PLAYER_HUD_BUTTON_KEYS.
 *
 * Overrides en `hudLayout.overrides` (se fusionan en capas):
 * 1. `service` | `vod` | `catchup` — todas las plataformas
 * 2. `tv:service` | `pc:vod` | … — plataforma + tipo (más específico)
 * 3. `tv` | `pc` — solo plataforma
 * @example
 * overrides: {
 *   service: { top: { left: ['back', 'channels'] }, bottom: ['goLive'] },
 *   'tv:service': { top: { right: ['clock'] } },
 *   'pc:service': { top: { right: ['clock', 'fullscreen'] } },
 *   vod: { center: ['rewind', 'play', 'forward'] },
 *   'pc:vod': { top: { right: ['fullscreen', 'clock'] } },
 * }
 */

export const PLAYER_HUD_BUTTON_KEYS = Object.freeze({
  BACK: 'back',
  EPG: 'epg',
  LOCK: 'lock',
  CHANNELS: 'channels',
  INFO: 'info',
  TRACKS: 'tracks',
  REWIND: 'rewind',
  PLAY: 'play',
  FORWARD: 'forward',
  FULLSCREEN: 'fullscreen',
  CLOCK: 'clock',
  GO_LIVE: 'goLive',
});

/** @type {ReadonlySet<string>} */
export const VALID_PLAYER_HUD_BUTTON_KEYS = new Set(Object.values(PLAYER_HUD_BUTTON_KEYS));

/** Layout por defecto (paridad con el HUD fijo anterior). */
export const DEFAULT_PLAYER_HUD_LAYOUT = Object.freeze({
  top: Object.freeze({
    left: Object.freeze([
      PLAYER_HUD_BUTTON_KEYS.BACK,
      PLAYER_HUD_BUTTON_KEYS.EPG,
      PLAYER_HUD_BUTTON_KEYS.LOCK,
      PLAYER_HUD_BUTTON_KEYS.CHANNELS,
      PLAYER_HUD_BUTTON_KEYS.INFO,
      PLAYER_HUD_BUTTON_KEYS.TRACKS,
    ]),
    center: Object.freeze([
      PLAYER_HUD_BUTTON_KEYS.REWIND,
      PLAYER_HUD_BUTTON_KEYS.PLAY,
      PLAYER_HUD_BUTTON_KEYS.FORWARD,
    ]),
    right: Object.freeze([
      PLAYER_HUD_BUTTON_KEYS.FULLSCREEN,
      PLAYER_HUD_BUTTON_KEYS.CLOCK,
    ]),
  }),
  bottom: Object.freeze([PLAYER_HUD_BUTTON_KEYS.GO_LIVE]),
});
