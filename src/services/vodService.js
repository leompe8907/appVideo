/**
 * Servicio de carga y preparación de datos VOD.
 * Equivalente a getVOD/callGetVODContent/prepareDataForVOD de app-data.js (10foot).
 * Pensado para usarse desde PreloadContext en paralelo con EPG.
 */

import panaccessService from './panaccessService';

const VOD_CONTENT_PAGE_SIZE = 100;
const VOD_CONTENT_MAX_OFFSET = 1000;

/**
 * Construye URLs de imagen VOD. Si brandConfig tiene vod.imageUrlTemplates se usan;
 * si no, se devuelve null y el UI puede usar placeholders.
 * @param {Object} vod - Ítem VOD con image1Id, image2Id, image3Id
 * @param {string} baseUrl - URL base (p. ej. brandConfig.drm)
 * @param {Object} templates - { posterList, posterInfo, original } con %base_url% y %image_id%
 */
function buildVodImageUrls(vod, baseUrl, templates = {}) {
  const base = (baseUrl || '').replace(/\/?$/, '');
  const result = {};
  if (vod.image1Id != null && templates.posterList) {
    result.posterListURL = templates.posterList.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image1Id);
  }
  if (vod.image1Id != null && templates.posterInfo) {
    result.posterInfoURL = templates.posterInfo.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image1Id);
  }
  if (vod.image2Id != null && templates.original) {
    result.extraImageURL = templates.original.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image2Id);
  }
  if (vod.image3Id != null && templates.original) {
    result.backgroundImageURL = templates.original.replace(/%base_url%/g, base).replace(/%image_id%/g, vod.image3Id);
  }
  if (templates.original) {
    result.baseImageUrl = templates.original.replace(/%base_url%/g, base).replace(/%image_id%/g, '{id}');
  }
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
  const templates = imageTemplates || {};

  categories.forEach((category, index) => {
    const filtered = (vods || []).filter((vod) =>
      Array.isArray(vod.categories) && vod.categories.indexOf(category.id) >= 0
    );
    filtered.forEach((vod, i) => {
      const urls = buildVodImageUrls(vod, baseUrl, templates);
      Object.assign(filtered[i], urls);
    });
    categories[index].vods = filtered;
    allVods.push(...filtered);
  });

  const series = (vods || []).filter((vod) => vod.isSeries === true);
  if (series.length > 0 && categories.length > 0) {
    series.sort((a, b) => (a.name != null && b.name != null ? (a.name > b.name ? 1 : a.name < b.name ? -1 : 0) : 0));
    categories.push({ id: 0, name: t('vod.seriesCategory') || 'Séries', vods: series });
    allVods.push(...series);
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
  const imageTemplates = brandConfig?.vod?.imageUrlTemplates || {};

  const libraryResponse = await panaccessService.getVodLibraries({ enableRetry });
  const library = Array.isArray(libraryResponse) && libraryResponse.length > 0
    ? libraryResponse[0]
    : (libraryResponse && typeof libraryResponse === 'object' && libraryResponse.categoryGroups != null ? libraryResponse : {});
  const categoryGroups = (library.categoryGroups || []).filter((g) => g.type === 5 || g.type === 6);

  const categories = categoryGroups.flatMap((g) => g.categories || []);
  categories.forEach((cat, i) => {
    if (cat.name) categories[i].name = typeof t === 'function' ? t(cat.name) : cat.name;
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
};
