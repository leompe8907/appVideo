/**
 * Lógica pura del RECEPTOR de transmisiones (sin React): resuelve el
 * contenido recibido a una reproducción de esta app, traduce el estado del
 * reproductor al formato del protocolo y aplica los comandos remotos.
 *
 * Separado del hook (`hooks/useCastReceiver.js`) para poder probarlo sin
 * montar la app. Contrato: docs/DISENO_TECNICO_CASTEO_2026-10-05.md (backend).
 *
 * Idea central: el mensaje trae solo la IDENTIDAD del contenido (`kind` +
 * `id`), nunca una URL. Este dispositivo arma la suya con su propia sesión
 * de PanAccess, igual que ya hace `utils/adActivate.js` con los anuncios.
 */

import { CAST_KINDS, msToSeconds } from './castService';

function findStreamById(streams, id) {
  if (id == null || !Array.isArray(streams)) return null;
  const sid = String(id);
  return streams.find((s) => s && String(s.id) === sid) || null;
}

function safeNormalize(panaccess, url) {
  try {
    return panaccess.normalizePlaybackUrl(url);
  } catch {
    return url;
  }
}

/**
 * Convierte el contenido recibido en lo necesario para reproducirlo.
 *
 * @param {{kind: string, id: number, title?: string|null}} content
 * @param {{streams: Array, panaccess: object}} deps
 * @returns {{error: string} | {gate: 'channel'|'media', channel?: object, play: object}}
 */
export function resolvePlayRequest(content, { streams, panaccess }) {
  if (!content || !panaccess) return { error: 'unsupported_content' };

  if (content.kind === CAST_KINDS.SERVICE) {
    const stream = findStreamById(streams, content.id);
    // Canal que este dispositivo no tiene en su catálogo/paquete.
    if (!stream) return { error: 'unsupported_content' };

    const streamId = stream.epgStreamId ?? stream.id;
    let url = stream.url || stream.streamUrl || stream.hlsUrl || stream.hls;
    if (!url && streamId != null) {
      try {
        url = panaccess.getStreamM3u8Url({ streamId });
      } catch {
        url = null;
      }
    }
    if (!url) return { error: 'unsupported_content' };

    return {
      gate: 'channel',
      channel: stream,
      play: { type: 'service', id: stream.id, url: safeNormalize(panaccess, url), item: stream, autoPlay: true },
    };
  }

  if (content.kind === CAST_KINDS.CATCHUP || content.kind === CAST_KINDS.VOD) {
    const isVod = content.kind === CAST_KINDS.VOD;
    let url;
    try {
      url = isVod
        ? panaccess.getVodM3u8Url({ vodId: content.id })
        : panaccess.getCatchupM3u8Url({ catchupId: content.id });
    } catch {
      return { error: 'unsupported_content' };
    }
    if (!url) return { error: 'unsupported_content' };

    // `item` con el mismo shape mínimo que usan los anuncios (adActivate) y
    // que lee la telemetría (`buildStartData`).
    const item = isVod
      ? { id: content.id, vodId: content.id, name: content.title || '' }
      : { id: content.id, catchupId: content.id, name: content.title || '' };

    return {
      gate: 'media',
      play: {
        type: isVod ? 'vod' : 'catchup',
        id: content.id,
        url: safeNormalize(panaccess, url),
        item,
        autoPlay: true,
      },
    };
  }

  return { error: 'unsupported_content' };
}

function mapTracks(list) {
  return (Array.isArray(list) ? list : [])
    .filter((t) => t && t.id != null)
    .map((t) => ({
      id: String(t.id),
      label: t.label ?? t.name ?? t.language ?? null,
      lang: t.lang ?? t.language ?? null,
    }));
}

/**
 * Estado del reproductor -> cuerpo de `cast.state`.
 * `positionMs`/`durationMs` son enteros en ms (el reproductor usa segundos).
 */
export function buildCastState(playerState, tracks, content) {
  const s = playerState || {};
  let state;
  if (!s.url) state = 'idle';
  else if (s.error) state = 'error';
  else if (s.isLoading) state = 'loading';
  else if (s.isPlaying) state = 'playing';
  else if (s.type !== 'service' && s.duration > 0 && s.currentTime >= s.duration - 0.5) state = 'ended';
  else state = 'paused';

  const body = {
    state,
    position_ms: Math.max(0, Math.round((Number.isFinite(s.currentTime) ? s.currentTime : 0) * 1000)),
    duration_ms: Math.max(0, Math.round((Number.isFinite(s.duration) ? s.duration : 0) * 1000)),
  };
  if (Number.isFinite(s.volume)) body.volume = Math.min(1, Math.max(0, s.volume));
  if (content) body.content = { kind: content.kind, id: content.id };

  const t = tracks || {};
  body.tracks = {
    audio: mapTracks(t.audio),
    text: mapTracks(t.text),
    selected_audio: t.selectedAudioId != null ? String(t.selectedAudioId) : null,
    selected_text: t.textEnabled && t.selectedTextId != null ? String(t.selectedTextId) : null,
  };
  return body;
}

function findTrackId(list, wanted) {
  const found = (Array.isArray(list) ? list : []).find((t) => String(t?.id) === String(wanted));
  return found ? found.id : undefined;
}

/**
 * Aplica un `cast.command` sobre el reproductor. Devuelve true si el comando
 * se entendió y se aplicó (false: desconocido o inválido para el estado actual).
 *
 * @param {string} command
 * @param {object} args
 * @param {{ play: Function, pause: Function, stop: Function, seek: Function, setVolume: Function,
 *           selectAudioTrack: Function, selectTextTrack: Function, setSubtitlesEnabled: Function,
 *           state: object, tracks: object }} player
 */
export function applyCastCommand(command, args, player) {
  const a = args || {};
  switch (command) {
    case 'play': {
      const s = player.state;
      if (!s?.url) return false;
      player.play({ type: s.type, id: s.id, url: s.url, item: s.item, autoPlay: true });
      return true;
    }
    case 'pause':
      player.pause();
      return true;
    case 'stop':
      player.stop();
      return true;
    case 'seek':
      if (!Number.isFinite(a.position_ms)) return false;
      player.seek(msToSeconds(a.position_ms));
      return true;
    case 'set_volume':
      if (!Number.isFinite(a.volume)) return false;
      player.setVolume(a.volume);
      return true;
    case 'select_audio': {
      // El protocolo usa ids como texto; el motor puede usar números.
      const id = findTrackId(player.tracks?.audio, a.track_id);
      if (id === undefined) return false;
      player.selectAudioTrack(id);
      return true;
    }
    case 'select_text': {
      if (a.track_id === null || a.track_id === undefined) {
        player.setSubtitlesEnabled(false);
        return true;
      }
      const id = findTrackId(player.tracks?.text, a.track_id);
      if (id === undefined) return false;
      player.selectTextTrack(id);
      return true;
    }
    case 'request_state':
      // No cambia nada: el caller responde con el estado actual.
      return true;
    default:
      return false;
  }
}
