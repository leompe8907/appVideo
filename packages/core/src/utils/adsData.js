/**
 * Normalización y validación de anuncios (API Panaccess / HTML5), alineado con 10foot AppData + Ads.js.
 */

const VALID_EXT = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg)$/i;

/** locationType API: 1 = franja superior, 0 = inferior */
export const AD_LOCATION_TOP = 1;
export const AD_LOCATION_BOTTOM = 0;

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isValidFileUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\//.test(url) && VALID_EXT.test(url);
}

/**
 * @param {object} ad - Objeto ya mapeado (file, activationTime, expiryTime)
 * @returns {boolean}
 */
export function isAdCurrentlyValid(ad) {
  if (!ad || !isValidFileUrl(ad.file)) return false;
  const now = Date.now();
  if (ad.activationTime) {
    const t = ad.activationTime instanceof Date ? ad.activationTime.getTime() : new Date(ad.activationTime).getTime();
    if (!Number.isNaN(t) && now < t) return false;
  }
  if (ad.expiryTime) {
    const t = ad.expiryTime instanceof Date ? ad.expiryTime.getTime() : new Date(ad.expiryTime).getTime();
    if (!Number.isNaN(t) && now > t) return false;
  }
  return true;
}

/**
 * @param {object} ad
 * @returns {number} Milisegundos entre 2000 y 30000
 */
export function getDisplayTimeMs(ad) {
  const sec = ad?.displayTime;
  if (!sec || typeof sec !== 'number' || sec <= 0) {
    const isVid = isVideoUrl(ad?.file);
    return isVid ? 10000 : 5000;
  }
  const ms = sec * 1000;
  return Math.max(2000, Math.min(30000, ms));
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|webm|ogg)$/i.test(url);
}

/**
 * Mapea un ítem crudo del API a forma interna (como app-data getAds en 10foot).
 * @param {object} raw
 * @returns {object}
 */
export function mapRawAd(raw) {
  return {
    actionUrl: raw.actionUrl || null,
    activationTime: raw.activationTime ? new Date(raw.activationTime) : null,
    groupId: raw.adGroupId ?? raw.groupId,
    id: raw.adId ?? raw.id,
    file: raw.advertFile ?? raw.file,
    cdnGroupId: raw.cdnGroupId,
    dismissTime: Number(raw.dismissTimeS ?? raw.dismissTime ?? 0) || 0,
    displayTime: Number(raw.displayTimeS ?? raw.displayTime ?? 0) || 0,
    expiryTime: raw.expiryTime ? new Date(raw.expiryTime) : null,
    genericData: raw.genericData || null,
    isGeneral: raw.isGeneral || false,
    locationKey: raw.locationKey || null,
    locationType: raw.locationType != null ? Number(raw.locationType) : undefined,
    name: raw.name,
    targetKey: raw.targetKey,
    targetType: raw.targetType,
    text: raw.text || null,
    type: raw.type,
  };
}

/**
 * Lista cruda del API → filtro html5 + mapeo + validez temporal y URL.
 * @param {Array} rawList
 * @returns {{ processed: Array, top: Array, bottom: Array }}
 */
export function processAdsFromApi(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  const filtered = list.filter((a) => a && String(a.targetKey).toLowerCase() === 'android_tv');
  const processed = filtered.map(mapRawAd).filter(isAdCurrentlyValid);
  const top = processed.filter((a) => a.locationType === AD_LOCATION_TOP);
  const bottom = processed.filter((a) => a.locationType === AD_LOCATION_BOTTOM);
  return { processed, top, bottom };
}
