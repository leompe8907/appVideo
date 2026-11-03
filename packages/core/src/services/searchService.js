import { getVodImageUrl } from './vodService';

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
      if (!ev || (!ev.name && !ev.title)) continue;
      out.push({
        ...ev,
        catchupGroupName: g.name ?? g.catchupGroupId ?? '',
        channelName: g.name ?? ev.channelName ?? '',
        channelImg: g.img || g.imageUrl || g.logoUrl || g.logo || g.icon || null,
        channelLcn: g.lcn ?? ev.lcn ?? null,
      });
    }
  }
  return out;
}

function getEpgEventTitle(ev) {
  return ev?.languages?.[0]?.title || ev?.title || ev?.name || '';
}

function getEpgEventImageUrl(ev) {
  if (!ev) return '';
  // Heurística: distintos backends usan distintos campos.
  const direct =
    ev.imageUrl ||
    ev.image ||
    ev.img ||
    ev.icon ||
    ev.posterUrl ||
    ev.coverUrl ||
    ev.thumbnailUrl ||
    ev.backgroundImageURL ||
    ev.posterInfoURL ||
    ev.posterListURL ||
    '';
  if (direct) return direct;

  const fromImagesArray =
    (Array.isArray(ev.images) && (ev.images[0]?.url || ev.images[0]?.src || ev.images[0]?.href)) ||
    null;
  if (fromImagesArray) return fromImagesArray;

  const fromLanguages =
    ev?.languages?.[0]?.imageUrl ||
    ev?.languages?.[0]?.img ||
    ev?.languages?.[0]?.posterUrl ||
    '';
  return fromLanguages || '';
}

function getMs(v) {
  if (v == null) return NaN;
  if (typeof v?.valueOf === 'function') return v.valueOf();
  const ms = new Date(v).getTime();
  return ms;
}

function getAllEpgEventsFromStreams(services, { nowMs } = {}) {
  const list = Array.isArray(services) ? services : [];
  const out = [];
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();

  for (const ch of list) {
    const epgItems = ch?.epgItems;
    if (!Array.isArray(epgItems) || epgItems.length === 0) continue;

    for (const ev of epgItems) {
      const title = getEpgEventTitle(ev);
      if (!title) continue;

      const endMs = getMs(ev?.endDate ?? ev?.end);
      if (!Number.isFinite(endMs)) continue;
      // “de la fecha hacia adelante”: incluir eventos actuales (en curso) y futuros
      if (endMs < now) continue;

      out.push({ channel: ch, event: ev, title, endMs });
    }
  }

  return out;
}

/**
 * Misma prioridad que VodCard / detalle: URLs preparadas + fallback por image1Id/2/3 + drm.
 */
function resolveVodPosterUrl(item, drmBaseUrl) {
  const direct =
    item?.backgroundImageURL ||
    item?.posterInfoURL ||
    item?.posterListURL ||
    item?.extraImageURL ||
    item?.img ||
    '';
  if (direct) return direct;

  const base = String(drmBaseUrl || '').replace(/\/?$/, '');
  if (!base) return '';

  if (item?.image1Id != null) {
    const u = getVodImageUrl(base, item.image1Id, 'posterList');
    if (u) return u;
  }
  if (item?.image2Id != null) {
    const u = getVodImageUrl(base, item.image2Id, 'original');
    if (u) return u;
  }
  if (item?.image3Id != null) {
    const u = getVodImageUrl(base, item.image3Id, 'original');
    if (u) return u;
  }
  return '';
}

/**
 * Series: primero background (o image3 → original); si falta o falla la carga, posterInfo (o image1 → posterInfo).
 * Devuelve `vodPosterFallback` solo cuando hay una URL secundaria distinta de la principal (para onError en UI).
 */
/** Año de estreno (misma heurística que detalle VOD). */
function extractVodReleaseYear(vod) {
  const raw = vod?.libraryReleaseDate ?? vod?.releaseDate ?? '';
  const m = String(raw).trim().match(/^(\d{4})/);
  return m ? m[1] : null;
}

function firstPersonNameMatching(names, lowerQuery) {
  if (!Array.isArray(names)) return null;
  for (const n of names) {
    if (n != null && normalizeStr(n).indexOf(lowerQuery) !== -1) return String(n);
  }
  return null;
}

/**
 * Relevancia VOD: título > actor/director > año (4 dígitos).
 * Devuelve { relevance, vodSearchMeta } donde meta solo aplica si el título no matchea la query.
 */
function scoreVodSearch(vod, trimmed, lowerQuery) {
  const name = vod?.name ?? '';
  if (!name) return { relevance: 0, vodSearchMeta: null };

  const nameHit = normalizeStr(name).indexOf(lowerQuery) !== -1;
  let relevance = 0;
  if (nameHit) relevance = Math.max(relevance, calculateRelevance(name, trimmed));

  const actorHit = firstPersonNameMatching(vod?.actorNames, lowerQuery);
  const directorHit = firstPersonNameMatching(vod?.directorNames, lowerQuery);
  if (actorHit) {
    relevance = Math.max(relevance, Math.floor(calculateRelevance(actorHit, trimmed) * 0.82));
  }
  if (directorHit) {
    relevance = Math.max(relevance, Math.floor(calculateRelevance(directorHit, trimmed) * 0.82));
  }

  const releaseYear = extractVodReleaseYear(vod);
  const isYearQuery = /^\d{4}$/.test(trimmed);
  if (isYearQuery && releaseYear === trimmed) {
    relevance = Math.max(relevance, 430);
  }

  if (relevance <= 0) return { relevance: 0, vodSearchMeta: null };

  let vodSearchMeta = null;
  if (!nameHit) {
    if (isYearQuery && releaseYear === trimmed) {
      vodSearchMeta = { kind: 'year', value: releaseYear };
    } else if (actorHit) {
      vodSearchMeta = { kind: 'actor', value: actorHit };
    } else if (directorHit) {
      vodSearchMeta = { kind: 'director', value: directorHit };
    }
  }

  return { relevance, vodSearchMeta };
}

function resolveVodSeriesPosters(item, drmBaseUrl) {
  const base = String(drmBaseUrl || '').replace(/\/?$/, '');

  const background =
    item?.backgroundImageURL ||
    (base && item?.image3Id != null ? getVodImageUrl(base, item.image3Id, 'original') : '') ||
    '';

  let posterInfo =
    item?.posterInfoURL ||
    (base && item?.image1Id != null ? getVodImageUrl(base, item.image1Id, 'posterInfo') : '') ||
    '';

  if (!posterInfo && base && item?.image1Id != null) {
    posterInfo = getVodImageUrl(base, item.image1Id, 'posterList') || '';
  }

  if (background && posterInfo && background !== posterInfo) {
    return { logo: background, vodPosterFallback: posterInfo };
  }

  if (background) {
    return { logo: background, vodPosterFallback: '' };
  }

  if (posterInfo) {
    return { logo: posterInfo, vodPosterFallback: '' };
  }

  return { logo: resolveVodPosterUrl(item, drmBaseUrl), vodPosterFallback: '' };
}

function normalizeResult(item, type, ctx = {}) {
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
    if (item?.isSeries === true) {
      const { logo, vodPosterFallback } = resolveVodSeriesPosters(item, ctx.vodDrmBaseUrl);
      normalized.logo = logo;
      if (vodPosterFallback) normalized.vodPosterFallback = vodPosterFallback;
    } else {
      normalized.logo = resolveVodPosterUrl(item, ctx.vodDrmBaseUrl);
    }
  } else if (type === 'catchup') {
    normalized.logo = item?.imageUrl || item?.imageUrl2 || item?.catchupImageUrl || item?.img || item?.posterUrl || '';
    normalized.catchupId = item?.id ?? item?.catchupId ?? null;
  } else if (type === 'epg') {
    // item esperado: { channel, event, title }
    const startMs = getMs(item?.event?.startDate ?? item?.event?.start);
    const endMs = getMs(item?.event?.endDate ?? item?.event?.end);
    normalized.logo = getEpgEventImageUrl(item?.event) || item?.channel?.img || item?.channel?.logo || '';
    normalized.channelLogo = item?.channel?.img || item?.channel?.logo || '';
    normalized.lcn = item?.channel?.lcn ?? item?.channel?.LCN ?? null;
    normalized.channelName = item?.channel?.name ?? item?.channel?.title ?? '';
    normalized.startMs = Number.isFinite(startMs) ? startMs : null;
    normalized.endMs = Number.isFinite(endMs) ? endMs : null;
  }

  return normalized;
}

// --- Búsqueda por grupo (bouquet / grupo de catchup / categoría VOD) ---
// Réplica de las reglas de Android/iOS (BUSCADOR_POR_GRUPO.md, 05/10/2026,
// `SearchGroups` compartido). Se SUMA a la búsqueda por nombre de siempre.

const GROUP_MIN_LENGTH = 3;
const GROUP_EPG_DAYS = 2; // hoy y mañana
// Por debajo de cualquier coincidencia directa por nombre: lo que coincide por su
// propio nombre sale primero, el contenido del grupo detrás.
const GROUP_MATCH_RELEVANCE = 90;

/** Minúsculas + sin tildes (á→a, ñ→n, ç→c, ...). */
function normalizeGroupStr(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Aplica solo con 3+ caracteres (sin espacios de los bordes) y si no es solo números. */
function appliesToGroups(query) {
  const q = String(query || '').trim();
  return q.length >= GROUP_MIN_LENGTH && !/^\d+$/.test(q);
}

function isGroupMatch(name, normalizedQuery) {
  return !!name && normalizeGroupStr(name).includes(normalizedQuery);
}

function getEventStartMs(ev) {
  return getMs(ev?.startDate ?? ev?.start);
}

/** Asigna relevancia decreciente para conservar el orden de la lista (el sort final es estable). */
function withOrderedRelevance(items) {
  return items.map((item, i) => {
    item.relevance = GROUP_MATCH_RELEVANCE - i / 100000;
    return item;
  });
}

function searchByGroups({
  query,
  bouquets,
  services,
  catchupGroups,
  vods,
  vodCategories,
  vodDrmBaseUrl,
  nowMs,
}) {
  if (!appliesToGroups(query)) return [];
  const q = normalizeGroupStr(query.trim());
  const out = [];

  // 1. Canales de TODOS los bouquets que coinciden (Inicio y Canales), sin repetir.
  const seenChannels = new Set();
  const bouquetChannels = [];
  (Array.isArray(bouquets) ? bouquets : []).forEach((b) => {
    const bName = b?.name ?? b?.title ?? b?.Name ?? b?.Title ?? '';
    if (!isGroupMatch(bName, q)) return;
    (Array.isArray(b?.items) ? b.items : []).forEach((ch) => {
      if (!ch) return;
      const key = ch.id ?? ch.epgStreamId ?? ch.lcn;
      if (key != null) {
        if (seenChannels.has(key)) return;
        seenChannels.add(key);
      }
      bouquetChannels.push(ch);
    });
  });

  // Los canales del bouquet pueden venir sin `epgItems` (o sin epgStreamId): se
  // completan con el stream equivalente de `services` (por id / epgStreamId).
  const svcById = new Map();
  const svcByEpg = new Map();
  (Array.isArray(services) ? services : []).forEach((sv) => {
    if (sv?.id != null) svcById.set(String(sv.id), sv);
    const e = sv?.epgStreamId ?? sv?.epgStreamid;
    if (e != null && e !== '' && e !== 0 && e !== '0') svcByEpg.set(String(e), sv);
  });
  for (let i = 0; i < bouquetChannels.length; i++) {
    const ch = bouquetChannels[i];
    const e = ch.epgStreamId ?? ch.epgStreamid;
    const sv =
      (ch.id != null && svcById.get(String(ch.id))) ||
      (e != null && svcByEpg.get(String(e))) ||
      null;
    if (sv && sv !== ch) {
      const hasEpg = Array.isArray(ch.epgItems) && ch.epgItems.length > 0;
      bouquetChannels[i] = {
        ...sv,
        ...ch,
        epgStreamId: ch.epgStreamId ?? ch.epgStreamid ?? sv.epgStreamId ?? sv.epgStreamid,
        epgItems: hasEpg ? ch.epgItems : sv.epgItems ?? ch.epgItems ?? [],
      };
    }
  }

  withOrderedRelevance(
    bouquetChannels.map((ch) => normalizeResult(ch, 'service')).filter(Boolean)
  ).forEach((r) => out.push(r));

  // 2. Catchup: grupos cuyo epgStreamId es el de un canal del bouquet, o cuyo
  //    nombre coincide. Del más nuevo al más viejo.
  const epgIds = new Set(
    bouquetChannels
      .flatMap((c) => [c.epgStreamId ?? c.epgStreamid, c.id])
      .filter((v) => v != null && v !== '' && v !== 0 && v !== '0')
      .map(String)
  );
  const lcns = new Set(
    bouquetChannels.map((c) => c.lcn ?? c.LCN).filter((v) => v != null && v !== '').map(String)
  );
  const matchedGroups = (Array.isArray(catchupGroups) ? catchupGroups : []).filter((g) => {
    const gId = g?.epgStreamId ?? g?.epg_stream_id ?? g?.epgStreamid;
    if (gId != null && epgIds.has(String(gId))) return true;
    if (g?.lcn != null && lcns.has(String(g.lcn))) return true;
    return isGroupMatch(g?.name, q);
  });
  const catchupEvents = getAllCatchupEvents(matchedGroups).sort(
    (a, b) => (getEventStartMs(b) || 0) - (getEventStartMs(a) || 0)
  );
  withOrderedRelevance(
    catchupEvents.map((ev) => normalizeResult(ev, 'catchup')).filter(Boolean)
  ).forEach((r) => out.push(r));

  // 3. Guía: eventos no terminados que empiezan antes del final de mañana
  //    (hora del dispositivo), por hora de comienzo.
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const untilMs = startOfToday.getTime() + GROUP_EPG_DAYS * 24 * 60 * 60 * 1000;
  const epgRows = getAllEpgEventsFromStreams(bouquetChannels, { nowMs })
    .filter(({ event }) => {
      const s = getEventStartMs(event);
      return !Number.isFinite(s) || s < untilMs;
    })
    .sort((a, b) => (getEventStartMs(a.event) || 0) - (getEventStartMs(b.event) || 0));
  withOrderedRelevance(
    epgRows
      .map(({ channel, event, title }) =>
        normalizeResult(
          {
            id: `${channel?.id ?? channel?.epgStreamId ?? 'ch'}-${event?.id ?? event?.eventId ?? event?.start ?? title}`,
            name: title,
            channel,
            event,
          },
          'epg'
        )
      )
      .filter(Boolean)
  ).forEach((r) => out.push(r));

  // 4. Películas de las categorías que coinciden (sin las de adultos si vienen marcadas).
  const matchedCatIds = new Set(
    (Array.isArray(vodCategories) ? vodCategories : [])
      .filter((c) => c && !c.isAdult && !c.adult && isGroupMatch(c.name, q))
      .map((c) => String(c.id))
  );
  if (matchedCatIds.size > 0) {
    const movies = (Array.isArray(vods) ? vods : []).filter((vod) =>
      (Array.isArray(vod?.categories) ? vod.categories : []).some((id) => matchedCatIds.has(String(id)))
    );
    withOrderedRelevance(
      movies.map((vod) => normalizeResult(vod, 'vod', { vodDrmBaseUrl })).filter(Boolean)
    ).forEach((r) => out.push(r));
  }

  return out;
}

/**
 * Busca sobre datos ya cargados (EPG/services, VOD, Catchup).
 * Retorna resultados normalizados ordenados por relevancia (desc).
 * Con 3+ caracteres (no solo números) suma el contenido de bouquets, grupos de
 * catchup y categorías VOD cuyo nombre coincide (ver `searchByGroups`).
 */
export function searchAll({
  query,
  services = [],
  vods = [],
  catchupGroups = [],
  bouquets = [],
  vodCategories = [],
  vodDrmBaseUrl = '',
} = {}) {
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

  // VOD: título, actores, directores, año (libraryReleaseDate)
  (Array.isArray(vods) ? vods : []).forEach((vod) => {
    const { relevance, vodSearchMeta } = scoreVodSearch(vod, trimmed, lowerQuery);
    if (relevance <= 0) return;
    const normalized = normalizeResult(vod, 'vod', { vodDrmBaseUrl });
    if (!normalized) return;
    normalized.relevance = relevance;
    if (vodSearchMeta) normalized.vodSearchMeta = vodSearchMeta;
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

  // EPG: eventos (desde ahora en adelante) aplanados por canal
  const epgEvents = getAllEpgEventsFromStreams(services, { nowMs: Date.now() });
  epgEvents.forEach(({ channel, event, title }) => {
    if (normalizeStr(title).indexOf(lowerQuery) === -1) return;
    const normalized = normalizeResult(
      {
        id: `${channel?.id ?? channel?.epgStreamId ?? 'ch'}-${event?.id ?? event?.eventId ?? event?.start ?? title}`,
        name: title,
        channel,
        event,
      },
      'epg'
    );
    if (!normalized) return;
    normalized.relevance = calculateRelevance(title, trimmed);
    allResults.push(normalized);
  });

  // Grupos (bouquet / grupo de catchup / categoría VOD): van DESPUÉS de las
  // coincidencias directas, así la deduplicación (se queda con la primera)
  // conserva la relevancia más alta si un ítem coincide por las dos vías.
  allResults.push(
    ...searchByGroups({
      query: trimmed,
      bouquets,
      services,
      catchupGroups,
      vods,
      vodCategories,
      vodDrmBaseUrl,
      nowMs: Date.now(),
    })
  );

  // Deduplicar por tipo+id por si la fuente de datos tiene duplicados
  const seen = new Set();
  const deduped = allResults.filter((r) => {
    if (r.id == null) return true;
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0));
  return deduped;
}

export default {
  searchAll,
  getSearchDebounceMs,
};

