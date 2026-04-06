/**
 * Servicio de carga y preparación de datos VOD.
 * Equivalente a getVOD/callGetVODContent/prepareDataForVOD de app-data.js (10foot).
 * Plantillas de imagen igual que 10foot config.js (vod_poster_list, vod_poster_info, original).
 */

import panaccessService from './panaccessService';

const VOD_CONTENT_PAGE_SIZE = 100;
const VOD_CONTENT_MAX_OFFSET = 1000;

/** Plantillas por defecto 10foot: mismo patrón que config.js imageUrlVodPosterList/Info/Original */
const DEFAULT_VOD_IMAGE_TEMPLATES = {
  posterList: '%base_url%/cv_data_pub/images/%image_id%/v/vod_poster_list.jpg',
  posterInfo: '%base_url%/cv_data_pub/images/%image_id%/v/vod_poster_info.jpg',
  original: '%base_url%/cv_data_pub/images/%image_id%/v/original.jpg',
};

/**
 * Construye una URL de imagen VOD a partir de baseUrl e imageId (fallback 10foot).
 * @param {string} baseUrl - URL base (p. ej. brandConfig.drm)
 * @param {string|number} imageId - ID de imagen (image1Id, image2Id, image3Id)
 * @param {'posterList'|'posterInfo'|'original'} type - Tipo de imagen
 * @returns {string} URL de la imagen
 */
export function getVodImageUrl(baseUrl, imageId, type = 'posterList') {
  if (baseUrl == null || imageId == null) return '';
  const base = String(baseUrl).replace(/\/?$/, '');
  const template = DEFAULT_VOD_IMAGE_TEMPLATES[type] || DEFAULT_VOD_IMAGE_TEMPLATES.posterList;
  return template.replace(/%base_url%/g, base).replace(/%image_id%/g, imageId);
}

/**
 * Construye URLs de imagen VOD. Usa plantillas de marca o las por defecto (10foot).
 * Siempre rellena posterListURL/posterInfoURL cuando hay image1Id (fallback como en home.js getHTMLRowVOD).
 * @param {Object} vod - Ítem VOD con image1Id, image2Id, image3Id
 * @param {string} baseUrl - URL base (p. ej. brandConfig.drm)
 * @param {Object} templates - { posterList, posterInfo, original } con %base_url% y %image_id%
 */
function buildVodImageUrls(vod, baseUrl, templates = {}) {
  const base = (baseUrl || '').replace(/\/?$/, '');
  const t = { ...DEFAULT_VOD_IMAGE_TEMPLATES, ...templates };
  const result = {};

  if (vod.image1Id != null) {
    const posterList = t.posterList ? t.posterList.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image1Id) : getVodImageUrl(base, vod.image1Id, 'posterList');
    const posterInfo = t.posterInfo ? t.posterInfo.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image1Id) : getVodImageUrl(base, vod.image1Id, 'posterInfo');
    result.posterListURL = posterList;
    result.posterInfoURL = posterInfo;
  }

  if (vod.image2Id != null) {
    result.extraImageURL = t.original ? t.original.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image2Id) : getVodImageUrl(base, vod.image2Id, 'original');
  }

  if (vod.image3Id != null) {
    result.backgroundImageURL = t.original ? t.original.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image3Id) : getVodImageUrl(base, vod.image3Id, 'original');
  }

  result.baseImageUrl = t.original ? t.original.replace(/%base_url%/g, base).replace(/%image_id%/g, '{id}') : (base + '/cv_data_pub/images/{id}/v/original.jpg');
  return result;
}

/**
 * Prepara categorías con vods asignados, series y recomendados (igual que app-data prepareDataForVOD).
 * @param {Array} vods - Lista plana de ítems VOD del API
 * @param {Array} categories - Categorías extraídas de getVodLibraries (type 5 y 6)
 * @param {number} vodRecommendedId - id del grupo "recomendados" (type 6)
 * @param {string} baseUrl - brandConfig.drm
 * @param {Object} imageTemplates - opcional, desde brandConfig.vod.imageUrlTemplates
 * @param {Function} t - opcional, función de traducción (p. ej. (key) => i18n.t(key))
 */
export function prepareDataForVOD(vods, categories, vodRecommendedId, baseUrl, imageTemplates = {}, t = (x) => x) {
  const allVods = [];
  const seenIds = new Set();
  const templates = imageTemplates || {};

  const pushUnique = (vod) => {
    if (vod.id != null) {
      if (seenIds.has(vod.id)) return;
      seenIds.add(vod.id);
    }
    allVods.push(vod);
  };

  categories.forEach((category, index) => {
    const filtered = (vods || []).filter((vod) =>
      Array.isArray(vod.categories) && vod.categories.indexOf(category.id) >= 0
    );
    filtered.forEach((vod, i) => {
      const urls = buildVodImageUrls(vod, baseUrl, templates);
      Object.assign(filtered[i], urls);
    });
    categories[index].vods = filtered;
    filtered.forEach(pushUnique);
  });

  const series = (vods || []).filter((vod) => vod.isSeries === true);
  if (series.length > 0 && categories.length > 0) {
    series.sort((a, b) => (a.name != null && b.name != null ? (a.name > b.name ? 1 : a.name < b.name ? -1 : 0) : 0));
    categories.push({ id: 0, name: t('vod.seriesCategory') || 'Séries', vods: series });
    series.forEach(pushUnique);
  }

  let vodRecommended = [];
  if (vodRecommendedId >= 0) {
    const recCat = categories.find((c) => c.id === vodRecommendedId);
    if (recCat && recCat.vods) vodRecommended = recCat.vods;
  }
  const categoriesWithoutRecommended = categories.filter((c) => c.id !== vodRecommendedId);
  categoriesWithoutRecommended.sort((a, b) =>
    a.name != null && b.name != null ? (a.name > b.name ? 1 : a.name < b.name ? -1 : 0) : 0
  );

  return {
    categories: categoriesWithoutRecommended,
    allVods,
    vodRecommended,
  };
}

/**
 * Carga todo el VOD: bibliotecas → categorías → contenido paginado → prepareDataForVOD.
 * No bloquea: se puede ejecutar en paralelo con loadEPG.
 * @param {Object} brandConfig - Config de marca (drm, vod.imageUrlTemplates, etc.)
 * @param {Object} options - onProgress(loadedCount), t (traducción), enableRetry
 * @returns {Promise<{ categories, allVods, vodRecommended }>}
 */
export async function loadVODData(brandConfig, options = {}) {
  const { onProgress = () => {}, t = (x) => x, enableRetry = false } = options;
  const baseUrl = brandConfig?.drm || '';
  const imageTemplates = { ...DEFAULT_VOD_IMAGE_TEMPLATES, ...(brandConfig?.vod?.imageUrlTemplates || {}) };

  const libraryResponse = await panaccessService.getVodLibraries({ enableRetry });
  const library = Array.isArray(libraryResponse) && libraryResponse.length > 0
    ? libraryResponse[0]
    : (libraryResponse && typeof libraryResponse === 'object' && libraryResponse.categoryGroups != null ? libraryResponse : {});
  const categoryGroups = (library.categoryGroups || []).filter((g) => g.type === 5 || g.type === 6);

  const categories = categoryGroups.flatMap((g) => g.categories || []);
  categories.forEach((cat, i) => {
    if (cat.name && typeof t === 'function') {
      const key = `vod.categories.${cat.name}`;
      const translated = t(key);
      categories[i].name = translated !== key ? translated : cat.name;
    }
  });

  let vodRecommendedId = -1;
  const recGroup = (library.categoryGroups || []).find((g) => g.type === 6);
  if (recGroup) vodRecommendedId = recGroup.id;

  const allVods = [];
  let offset = 0;

  while (offset <= VOD_CONTENT_MAX_OFFSET) {
    const page = await panaccessService.getVodContent({ offset, limit: VOD_CONTENT_PAGE_SIZE, enableRetry });
    const list = Array.isArray(page) ? page : (page && Array.isArray(page.items) ? page.items : []);
    if (list.length === 0) break;
    allVods.push(...list);
    onProgress(allVods.length);
    if (list.length < VOD_CONTENT_PAGE_SIZE) break;
    offset += VOD_CONTENT_PAGE_SIZE;
  }

  return prepareDataForVOD(allVods, categories, vodRecommendedId, baseUrl, imageTemplates, t);
}

export default {
  loadVODData,
  prepareDataForVOD,
  getVodImageUrl,
  DEFAULT_VOD_IMAGE_TEMPLATES,
};
