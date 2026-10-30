/**
 * `crypto.getRandomValues` para Vega. React Native no lo trae y CryptoJS
 * (usado por @appvideo/core para cifrar la sesión guardada) lo necesita para
 * la sal de AES: sin esto el login falla con "Native crypto module could not
 * be used to get secure random number".
 *
 * La entropía sale de `WebCrypto.randomUUID()` de react-native-w3cmedia, que
 * es nativo: de cada UUID v4 se toman los 30 dígitos hex aleatorios (se
 * descartan el de versión y el de variante) = 15 bytes. Sin Math.random.
 *
 * Debe importarse antes que crypto-js (ver index.js): CryptoJS busca
 * `global.crypto` al cargarse.
 */
import {WebCrypto} from '@amazon-devices/react-native-w3cmedia/dist/headless';

const MAX_BYTES = 65536; // mismo límite que la Web Crypto API

function randomBytesFromUuid() {
  const hex = String(WebCrypto.randomUUID()).replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error('randomUUID devolvió un valor inesperado');
  // Posición 12 = versión ("4"), 16 = variante (2 bits fijos): no son aleatorias.
  const random = hex.slice(0, 12) + hex.slice(13, 16) + hex.slice(17);
  const bytes = [];
  for (let i = 0; i < 30; i += 2) bytes.push(parseInt(random.slice(i, i + 2), 16));
  return bytes;
}

export function getRandomValues(typedArray) {
  if (!ArrayBuffer.isView(typedArray) || typedArray instanceof Float32Array || typedArray instanceof Float64Array) {
    throw new TypeError('getRandomValues: se espera un TypedArray entero');
  }
  if (typedArray.byteLength > MAX_BYTES) {
    throw new RangeError(`getRandomValues: máximo ${MAX_BYTES} bytes`);
  }
  const out = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  let filled = 0;
  while (filled < out.length) {
    for (const b of randomBytesFromUuid()) {
      if (filled >= out.length) break;
      out[filled] = b;
      filled += 1;
    }
  }
  return typedArray;
}

if (typeof global.crypto !== 'object' || global.crypto === null) {
  global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = getRandomValues;
}
