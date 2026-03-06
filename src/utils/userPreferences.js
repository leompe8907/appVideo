/**
 * Preferencias de usuario por marca: favoritos, canales bloqueados, historial de video.
 * Claves en localStorage con prefijo por brand para multi-marca.
 */

const KEYS = {
  favorites: 'USER_FAVORITES_KEY',
  lockedChannels: 'LOCKED_CHANNELS_KEY',
  channelData: 'CHANNEL_DATA_KEY',
  videoHistory: 'videoHistory',
  playerAudioLang: 'playerAudioLang',
  playerSubtitleLang: 'playerSubtitleLang',
};

function storageKey(brandId, key) {
  const brand = brandId || 'default';
  return `pref_${brand}_${key}`;
}

// --- Favoritos (LCN o IDs de canal) ---

export function getFavorites(brandId) {
  try {
    const raw = localStorage.getItem(storageKey(brandId, KEYS.favorites));
    if (raw == null || raw === '') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setFavorites(brandId, favorites) {
  const key = storageKey(brandId, KEYS.favorites);
  if (favorites == null || !Array.isArray(favorites)) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(favorites));
}

/** Devuelve true si el LCN/canal está en favoritos (corrige el bug del proyecto antiguo que devolvía indexOf). */
export function hasFavorite(brandId, lcn) {
  const list = getFavorites(brandId);
  return list.indexOf(Number(lcn)) >= 0;
}

export function toggleFavorite(brandId, lcn) {
  const list = getFavorites(brandId);
  const num = Number(lcn);
  const idx = list.indexOf(num);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(num);
  }
  setFavorites(brandId, list);
  return list.indexOf(num) >= 0;
}

// --- Canales bloqueados ---

export function getLockedChannels(brandId) {
  try {
    const raw = localStorage.getItem(storageKey(brandId, KEYS.lockedChannels));
    if (raw == null || raw === '') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setLockedChannels(brandId, channelIds) {
  const key = storageKey(brandId, KEYS.lockedChannels);
  if (channelIds == null || !Array.isArray(channelIds)) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(channelIds.map(Number)));
}

export function hasChannelLocked(brandId, serviceTVId) {
  const list = getLockedChannels(brandId);
  return list.indexOf(Number(serviceTVId)) >= 0;
}

export function toggleLockedChannel(brandId, serviceTVId) {
  const list = getLockedChannels(brandId);
  const num = Number(serviceTVId);
  const idx = list.indexOf(num);
  if (idx >= 0) {
    list.splice(idx, 1);
    setLockedChannels(brandId, list);
    return false;
  }
  list.push(num);
  setLockedChannels(brandId, list);
  return true;
}

// --- Historial de video [{ type, id, time }, ...] ---

export function getVideoHistory(brandId) {
  try {
    const raw = localStorage.getItem(storageKey(brandId, KEYS.videoHistory));
    if (raw == null || raw === '') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setVideoHistoryFor(brandId, videoHistory) {
  const list = getVideoHistory(brandId);
  const { type, id, time } = videoHistory;
  const idx = list.findIndex((item) => item.type === type && item.id === id);
  if (idx >= 0) {
    list[idx].time = time;
  } else {
    list.push({ type, id, time });
  }
  localStorage.setItem(storageKey(brandId, KEYS.videoHistory), JSON.stringify(list));
}

export function getVideoHistoryFor(brandId, type, id) {
  const list = getVideoHistory(brandId);
  const item = list.find((i) => i.type === type && i.id === id);
  return item ? item.time : 0;
}

// --- Datos por canal (audio/subtítulos seleccionados) ---

const PROP_AUDIO = 'audio';
const PROP_SUBTITLES = 'subtitles';

export function getChannelData(brandId) {
  try {
    const raw = localStorage.getItem(storageKey(brandId, KEYS.channelData));
    if (raw == null || raw === '') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setChannelData(brandId, channelId, propKey, value) {
  const channelData = getChannelData(brandId);
  const idx = channelData.findIndex((d) => d.channel === channelId);
  if (idx >= 0) {
    channelData[idx][propKey] = value;
  } else {
    channelData.push({ channel: channelId, [propKey]: value });
  }
  localStorage.setItem(storageKey(brandId, KEYS.channelData), JSON.stringify(channelData));
}

export function getAudioAndSubtitle(brandId, channelId) {
  const channelData = getChannelData(brandId);
  const entry = channelData.find((d) => d.channel === channelId);
  if (!entry) return [null, null];
  return [entry[PROP_AUDIO] ?? null, entry[PROP_SUBTITLES] ?? null];
}

// --- Idioma de reproductor (audio/subtítulos) global ---

export function getPlayerAudioLang() {
  const lang = localStorage.getItem(KEYS.playerAudioLang);
  return lang && lang.length > 0 ? lang : null;
}

export function setPlayerAudioLang(language) {
  if (language != null) localStorage.setItem(KEYS.playerAudioLang, language);
  else localStorage.removeItem(KEYS.playerAudioLang);
}

export function getPlayerSubtitleLang() {
  const lang = localStorage.getItem(KEYS.playerSubtitleLang);
  return lang && lang.length > 0 ? lang : null;
}

export function setPlayerSubtitleLang(language) {
  if (language != null) localStorage.setItem(KEYS.playerSubtitleLang, language);
  else localStorage.removeItem(KEYS.playerSubtitleLang);
}
