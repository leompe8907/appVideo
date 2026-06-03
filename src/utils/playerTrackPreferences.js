/**
 * Memoria de pistas de audio/subtítulos (paridad con 10foot nbplayer.js + user.js).
 *
 * - Clave por canal: serviceTV.epgStreamId (no LCN).
 * - Valor guardado: label de la pista (no idioma ni id).
 * - Restaurar en live (service): prefs del canal; audio sin guardar → idioma del dispositivo.
 * - Subtítulos desactivados: solo limpia playerSubtitleLang global (no persiste "off" por canal).
 */

import {
  getAudioAndSubtitle,
  setChannelData,
  setPlayerAudioLang,
  setPlayerSubtitleLang,
} from './userPreferences';

const PROP_AUDIO = 'audio';
const PROP_SUBTITLES = 'subtitles';

const ISO6392_FROM_BROWSER = {
  es: 'spa',
  en: 'eng',
  pt: 'por',
  fr: 'fre',
  de: 'deu',
  it: 'ita',
};

function normalizeStoredValue(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/** Igual que 10foot: guardar label de la pista. */
export function getTrackStorageLabel(track) {
  if (!track) return null;
  const label = track.label != null ? String(track.label).trim() : '';
  return label.length > 0 ? label : null;
}

/**
 * Clave de canal en CHANNEL_DATA_KEY (10foot: serviceTV.epgStreamId).
 * @param {{ type?: string, id?: unknown, item?: object } | null} playback
 */
export function getPlaybackChannelKey(playback) {
  if (!playback || playback.type !== 'service') return null;
  const item = playback.item;
  const epgId = item?.epgStreamId ?? item?.epg_stream_id;
  if (epgId != null && String(epgId).trim() !== '' && String(epgId) !== '0') {
    return epgId;
  }
  if (playback.id != null && String(playback.id).trim() !== '') {
    return playback.id;
  }
  return null;
}

/** Fallback de audio como 10foot: Device.getLanguageIso6392() → match por language. */
export function getDeviceAudioLanguageFallback() {
  const raw = (navigator.language || navigator.userLanguage || '').toLowerCase();
  const two = raw.split('-')[0];
  return ISO6392_FROM_BROWSER[two] || two;
}

/**
 * Busca pista por valor guardado (10foot usa property "label" con igualdad estricta).
 */
export function findTrackByPreference(tracks, saved, { preferLabel = true } = {}) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const raw = normalizeStoredValue(saved);
  if (!raw) return null;

  if (preferLabel) {
    const byLabel = tracks.find((t) => String(t.label ?? '') === raw);
    if (byLabel) return byLabel;
  }

  const byId = tracks.find((t) => String(t.id) === raw);
  if (byId) return byId;

  const lc = raw.toLowerCase();
  return (
    tracks.find((t) => String(t.lang || '').toLowerCase() === lc) ||
    tracks.find((t) => String(t.label || '').toLowerCase() === lc) ||
    null
  );
}

/** @returns {{ audio: string|null, subtitles: string|null }} */
export function getSavedTrackPreferences(brandId, playback) {
  const channelKey = getPlaybackChannelKey(playback);
  if (channelKey == null) {
    return { audio: null, subtitles: null };
  }
  const [audio, subtitles] = getAudioAndSubtitle(brandId, channelKey);
  return {
    audio: normalizeStoredValue(audio),
    subtitles: normalizeStoredValue(subtitles),
  };
}

/** Al elegir audio (10foot: updateChannelTrack + setPlayerAudioLang(label)). */
export function persistAudioPreference(brandId, playback, track) {
  const label = getTrackStorageLabel(track);
  if (!label) return;

  setPlayerAudioLang(label, brandId);
  const channelKey = getPlaybackChannelKey(playback);
  if (channelKey != null) {
    setChannelData(brandId, channelKey, PROP_AUDIO, label);
  }
}

/**
 * Al elegir subtítulos (10foot).
 * - Desactivar: setPlayerSubtitleLang(null), no toca CHANNEL_DATA.
 * - Activar: setPlayerSubtitleLang(label) + setChannelData(subtitles, label).
 */
export function persistSubtitlePreference(brandId, playback, { enabled, track }) {
  if (!enabled) {
    setPlayerSubtitleLang(null, brandId);
    return;
  }

  const label = getTrackStorageLabel(track);
  if (!label) return;

  setPlayerSubtitleLang(label, brandId);
  const channelKey = getPlaybackChannelKey(playback);
  if (channelKey != null) {
    setChannelData(brandId, channelKey, PROP_SUBTITLES, label);
  }
}

/**
 * Aplica preferencias al engine (equivalente a playerLoadedMetadata en 10foot).
 * Solo aplica lógica de canal/dispositivo en type === 'service'.
 */
export function applySavedTrackPreferences(engine, brandId, playback, snap) {
  if (!engine || !snap || playback?.type !== 'service') return false;

  const { audio: audioLabel, subtitles: subtitleLabel } = getSavedTrackPreferences(
    brandId,
    playback,
  );

  let applied = false;

  if (snap.audio?.length) {
    let match = audioLabel ? findTrackByPreference(snap.audio, audioLabel) : null;
    if (!match && !audioLabel) {
      const deviceLang = getDeviceAudioLanguageFallback();
      if (deviceLang) {
        match = snap.audio.find((t) => String(t.lang || '').toLowerCase() === deviceLang) || null;
      }
    }
    if (match && String(snap.selectedAudioId) !== String(match.id)) {
      if (engine.selectAudioTrack?.(match.id)) applied = true;
    }
  }

  if (subtitleLabel && snap.text?.length) {
    const match = findTrackByPreference(snap.text, subtitleLabel);
    if (match) {
      const wantId = String(match.id);
      if (!snap.textEnabled || String(snap.selectedTextId) !== wantId) {
        if (engine.setSubtitlesEnabled?.(true) && engine.selectTextTrack?.(match.id)) {
          applied = true;
        }
      }
    }
  }

  return applied;
}
