/**
 * Teclas del control de Fire TV (`useTVEventHandler`, `eventType` de
 * react-native-kepler/Libraries/TV/TVTypes.d.ts).
 */

/** Dígito de `num_0`…`num_9`; null si no es un dígito. */
export function digitOfTvEvent(eventType) {
  const m = /^num_([0-9])$/.exec(String(eventType || ''));
  return m ? Number(m[1]) : null;
}

/**
 * CH+ → 1, CH− → −1, otra tecla → 0. El SDK las declara `channel_up` /
 * `channel_down`; se acepta también `channelUp` / `channelDown` (RN para TV).
 */
export function channelStepOfTvEvent(eventType) {
  if (eventType === 'channel_up' || eventType === 'channelUp') return 1;
  if (eventType === 'channel_down' || eventType === 'channelDown') return -1;
  return 0;
}
