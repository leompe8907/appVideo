/**
 * Qué registrar en la telemetría (telemetryService de core) para una
 * reproducción de la pantalla `vodplayer`, que sirve VOD y catchup.
 * @returns {{type: 'vod'|'catchup', id: any, item: object|null} | null}
 */
export function telemetryTargetForVodPlayer(params) {
  const type = params?.kind === 'catchup' ? 'catchup' : 'vod';
  const id = type === 'catchup' ? params?.catchupId : params?.vodId;
  const item = params?.item ?? null;
  if (id == null && !item) return null;
  return {type, id, item};
}
