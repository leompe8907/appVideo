/**
 * Arma el array `BRANDS` a partir de la configuración COMPLETA y explícita de
 * cada marca (`./<slug>.js`) -- ver el JSDoc del shape en `../brands.js`.
 *
 * Por qué está separado en un archivo por marca: `../brands.js` llegó a
 * tener 3000+ líneas (7 marcas en un único array literal) -- un cambio en
 * UNA marca requería revisar un archivo enorme y arriesgaba tocar sin
 * querer la de al lado. Acá cada archivo de marca es autocontenido: tiene
 * TODOS los parámetros explícitos, sin depender de un merge con una base
 * compartida en tiempo de ejecución (`./defaults.js` existe solo como
 * referencia/plantilla para crear una marca nueva, no se importa acá).
 */
import bromteck from './bromteck.js';
import intv from './intv.js';
import gigmax from './gigmax.js';
import cableatlantico from './cableatlantico.js';
import wind from './wind.js';
import multiplustv from './multiplustv.js';
import sattv from './sattv.js';

export const BRANDS = [bromteck, intv, gigmax, cableatlantico, wind, multiplustv, sattv];
