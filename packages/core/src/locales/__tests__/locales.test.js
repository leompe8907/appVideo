import { describe, it, expect } from 'vitest';
import es from '../es.json';
import en from '../en.json';
import pt from '../pt.json';

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Claves que usan las pantallas de error de la web (ErrorBoundary) y de Vega.
// Si faltan, i18next muestra el nombre de la clave en pantalla.
const ERROR_SCREEN_KEYS = ['errors.loadAppTitle', 'errors.loadAppHint', 'common.retry', 'common.exit'];

describe('locales', () => {
  for (const [lang, dict] of Object.entries({ es, en, pt })) {
    it(`${lang} tiene las claves de las pantallas de error`, () => {
      for (const key of ERROR_SCREEN_KEYS) {
        expect(typeof get(dict, key), key).toBe('string');
      }
    });
  }
});
