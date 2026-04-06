const DEBOUNCE_DELAY_MS = 300;
const MIN_QUERY_LENGTH = 1;

export function getSearchDebounceMs() {
  return DEBOUNCE_DELAY_MS;
}

function normalizeStr(s) {
  return String(s || '').toLowerCase();
}

function calculateRelevance(text, query) {
  if (!text || !query) return 0;
  const lowerText = normalizeStr(text);
  const lowerQuery = normalizeStr(query);
  let score = 0;

  if (lowerText === lowerQuery) score += 1000;
  else if (lowerText.indexOf(lowerQuery) === 0) score += 500;
  else if (lowerText.indexOf(lowerQuery) !== -1) score += 100;

  const queryWords = lowerQuery.split(/\s+/).filter(Boolean);
  const textWords = lowerText.split(/\s+/);
  for (const qw of queryWords) {
    for (const tw of textWords) {
      if (tw === qw) score += 50;
      else if (tw.indexOf(qw) === 0) score += 25;
    }
  }

  score -= Math.floor(String(text).length / 10);
  return score;
}

function calculateRelevanceLcn(lcn, query) {
  if (lcn == null || lcn === '' || !query) return 0;
  const lcnStr = String(lcn);
  const queryStr = String(query).trim();
  if (!queryStr) return 0;

  const queryNum = Number(queryStr);
  if (queryStr === String(queryNum) && Number(lcn) === queryNum) return 600;
  if (lcnStr.indexOf(queryStr) === 0) return 400;
  if (lcnStr.indexOf(queryStr) !== -1) return 150;
  return 0;
}

function getAllCatchupEvents(groups) {
  const list = Array.isArray(groups) ? groups : [];
  const out = [];
  for (const g of list) {
    const events = g?.events;
    if (!Array.isArray(events)) continue;
    for (const ev of events) {
      if (ev && (ev.name || ev.title)) out.push(ev);
    }
  }
  return out;
}

function normalizeResult(item, type) {
  const name = item?.name ?? item?.title ?? item?.Name ?? item?.Title ?? '';
  if (!name) return null;

  const normalized = {
    id: item?.id ?? item?.catchupId ?? item?.vodId ?? item?.epgStreamId ?? null,
    name,
    type,
    relevance: 0,
    raw: item,
    logo: '',
  };

  if (type === 'service') {
    normalized.logo = item?.img || item?.logo || '';
    normalized.lcn = item?.lcn ?? item?.LCN ?? null;
  } else if (type === 'vod') {
    normalized.logo = item?.backgroundImageURL || item?.posterInfoURL || item?.posterListURL || item?.img || '';
  } else if (type === 'catchup') {
    normalized.logo = item?.imageUrl || item?.imageUrl2 || item?.catchupImageUrl || item?.img || item?.posterUrl || '';
    normalized.catchupId = item?.catchupId ?? item?.id ?? null;
  }

  return normalized;
}

/**
 * Busca sobre datos ya cargados (EPG/services, VOD, Catchup).
 * Retorna resultados normalizados ordenados por relevancia (desc).
 */
export function searchAll({ query, services = [], vods = [], catchupGroups = [] }) {
  const results = [];
  if (!query || typeof query !== 'string') return results;
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return results;
  const lowerQuery = trimmed.toLowerCase();

  const allResults = [];

  // Services: nombre + LCN
  (Array.isArray(services) ? services : []).forEach((service) => {
    if (!service) return;
    const name = service.name ?? service.title ?? '';
    const matchByName = name && normalizeStr(name).indexOf(lowerQuery) !== -1;
    const lcnRelevance = calculateRelevanceLcn(service.lcn ?? service.LCN, trimmed);
    const matchByLcn = lcnRelevance > 0;
    if (!matchByName && !matchByLcn) return;
    const normalized = normalizeResult(service, 'service');
    if (!normalized) return;
    const nameRelevance = matchByName ? calculateRelevance(name, trimmed) : 0;
    normalized.relevance = Math.max(nameRelevance, lcnRelevance);
    allResults.push(normalized);
  });

  // VOD: nombre
  (Array.isArray(vods) ? vods : []).forEach((vod) => {
    const name = vod?.name;
    if (!name) return;
    if (normalizeStr(name).indexOf(lowerQuery) === -1) return;
    const normalized = normalizeResult(vod, 'vod');
    if (!normalized) return;
    normalized.relevance = calculateRelevance(name, trimmed);
    allResults.push(normalized);
  });

  // Catchup: eventos aplanados
  const catchups = getAllCatchupEvents(catchupGroups);
  catchups.forEach((ev) => {
    const name = ev?.name ?? ev?.title;
    if (!name) return;
    if (normalizeStr(name).indexOf(lowerQuery) === -1) return;
    const normalized = normalizeResult(ev, 'catchup');
    if (!normalized) return;
    normalized.relevance = calculateRelevance(name, trimmed);
    allResults.push(normalized);
  });

  allResults.sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0));
  return allResults;
}

export default {
  searchAll,
  getSearchDebounceMs,
};

