import { describe, it, expect } from 'vitest';
import es from '../es.json';
import en from '../en.json';
import pt from '../pt.json';

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Claves que usan las pantallas de error de la web (ErrorBoundary) y de Vega.
// Si faltan, i18next muestra el nombre de la clave en pantalla.
const ERROR_SCREEN_KEYS = ['errors.loadAppTitle', 'errors.loadAppHint', 'common.retry', 'common.exit'];
// Aviso de Vega para cuentas con perfiles externos (sin pantalla de perfiles todavía).
const PROFILES_UNAVAILABLE_KEYS = ['profile.unavailableTitle', 'profile.unavailableMessage', 'common.logout'];
// Textos del reproductor y de Vega que antes estaban fijos o sólo con defaultValue en español.
const PLAYER_KEYS = [
  'player.now',
  'player.next',
  'player.channelList',
  'player.tracks',
  'player.audio',
  'player.subtitles',
  'player.subtitlesOff',
  'player.noAudioTracks',
  'player.noSubtitleTracks',
  'common.comingSoon',
  'vod.episodeNumber',
];

describe('locales', () => {
  for (const [lang, dict] of Object.entries({ es, en, pt })) {
    it(`${lang} tiene las claves de las pantallas de error`, () => {
      for (const key of ERROR_SCREEN_KEYS) {
        expect(typeof get(dict, key), key).toBe('string');
      }
    });

    it(`${lang} tiene las claves del reproductor`, () => {
      for (const key of PLAYER_KEYS) {
        expect(typeof get(dict, key), key).toBe('string');
      }
    });

    it(`${lang} tiene las claves del aviso de perfiles de Vega`, () => {
      for (const key of PROFILES_UNAVAILABLE_KEYS) {
        expect(typeof get(dict, key), key).toBe('string');
      }
    });
  }
});
