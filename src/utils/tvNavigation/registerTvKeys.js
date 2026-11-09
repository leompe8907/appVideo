/**
 * Samsung Tizen sólo entrega a la app las teclas básicas (flechas, OK, Return)
 * salvo que se registren las demás con tizen.tvinputdevice.registerKey.
 * Sin esto, CH±, media, números y colores nunca llegan al keydown.
 * Requiere el privilegio http://tizen.org/privilege/tv.inputdevice en config.xml.
 */
export const TIZEN_KEYS_TO_REGISTER = Object.freeze([
  'ChannelUp',
  'ChannelDown',
  'MediaPlay',
  'MediaPause',
  'MediaPlayPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'ColorF0Red',
  'ColorF1Green',
  'ColorF2Yellow',
  'ColorF3Blue',
]);

function getSupportedKeyNames(inputDevice) {
  try {
    const keys = inputDevice.getSupportedKeys?.();
    if (!Array.isArray(keys)) return null;
    return new Set(keys.map((k) => k?.name));
  } catch {
    return null;
  }
}

/**
 * Registra las teclas del control en Tizen. Fuera de Samsung no hace nada.
 * Cada tecla va en su propio try/catch: un modelo sin, p. ej., MediaPlayPause
 * no debe impedir que se registre CH±.
 * @returns {string[]} nombres registrados
 */
export function registerTvKeys(win = typeof window !== 'undefined' ? window : undefined) {
  const inputDevice = win?.tizen?.tvinputdevice;
  if (typeof inputDevice?.registerKey !== 'function') return [];

  const supported = getSupportedKeyNames(inputDevice);
  const registered = [];
  for (const name of TIZEN_KEYS_TO_REGISTER) {
    if (supported && !supported.has(name)) continue;
    try {
      inputDevice.registerKey(name);
      registered.push(name);
    } catch (e) {
      console.warn('[registerTvKeys] No se pudo registrar', name, e?.message || e);
    }
  }
  return registered;
}
