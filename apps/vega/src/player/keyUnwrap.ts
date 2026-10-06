// @ts-nocheck
/*
 * Port de appVideo (`src/player/engines/web/HlsPlaybackController.js` y
 * `sessionHlsXhrSetup.js`): las keys AES-128 rotativas del middleware de
 * Panaccess (`requestMode=mekey`, `f=getCatchupKey`, `f=getVodKey`) llegan
 * como 32 bytes = la key real de 16 bytes cifrada con AES-128-CBC + PKCS7
 * usando una key/IV fijas. Hay que descifrarlas antes de que Shaka valide
 * que la key mida 16 bytes.
 */
import {WebCrypto} from '@amazon-devices/react-native-w3cmedia/dist/headless';

const PANACCESS_KEY_WRAP_KEY = new Uint8Array([
  0xb2, 0xc2, 0x3a, 0x00, 0xff, 0xfe, 0x86, 0x90,
  0x17, 0x87, 0x05, 0xae, 0x19, 0xed, 0x08, 0xb8,
]);
const PANACCESS_KEY_WRAP_IV = new Uint8Array([
  0x91, 0x0f, 0x03, 0xa9, 0x67, 0x6d, 0x2b, 0xf4,
  0xe8, 0x22, 0x43, 0x37, 0xe7, 0x1a, 0x87, 0xd3,
]);

/** Key de prueba 00112233…ff envuelta con la key/IV de arriba (generada con openssl). */
export const SAMPLE_WRAPPED_KEY_HEX = 'f70ae0a9ccbec7477313a693fb7856eff6d246dc130ce83ab0b574655b95ae08';

export function isPanaccessRotatingKeyUri(url: string): boolean {
  if (typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('requestmode=mekey') ||
    lower.includes('f=getcatchupkey') ||
    lower.includes('f=getvodkey')
  );
}

export async function unwrapPanaccessKey(raw: ArrayBuffer): Promise<ArrayBuffer> {
  if (!raw || raw.byteLength <= 16) return raw;
  const wrapKey = await WebCrypto.subtle.importKey(
    'raw', PANACCESS_KEY_WRAP_KEY.buffer, {name: 'AES-CBC', length: 128}, true, ['decrypt']);
  return WebCrypto.subtle.decrypt({name: 'AES-CBC', iv: PANACCESS_KEY_WRAP_IV.buffer}, wrapKey, raw);
}
