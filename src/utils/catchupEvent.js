export function fmtHHmm(ms) {
  if (ms == null) return '';
  const d = ms instanceof Date ? ms : new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getLanguageEntry(event) {
  const lang = event?.languages;
  if (!lang) return null;
  if (Array.isArray(lang)) return lang[0] ?? null;
  if (typeof lang === 'object') return lang;
  return null;
}

export function getEventTitle(event) {
  const entry = getLanguageEntry(event);
  return (
    entry?.title ||
    event?.title ||
    event?.name ||
    event?.programTitle ||
    event?.eventName ||
    ''
  );
}

export function getEventDescription(event) {
  const entry = getLanguageEntry(event);
  return (
    entry?.extendedDescription ||
    entry?.description ||
    event?.extendedDescription ||
    event?.description ||
    event?.summary ||
    ''
  );
}

export function getEventImage(event) {
  return (
    event?.imageUrl ||
    event?.imageUrl2 ||
    event?.catchupImageUrl ||
    event?.posterUrl ||
    event?.image ||
    event?.poster ||
    null
  );
}

export function getEventStartMs(event) {
  const v = event?.startDate ?? event?.start ?? event?.start_date;
  if (v == null) return null;
  if (typeof v?.valueOf === 'function') {
    const ms = v.valueOf();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function fmtCatchupDate(ms, locale) {
  if (ms == null) return '';
  const d = ms instanceof Date ? ms : new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(locale || undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function fmtCatchupSchedule(ms, locale) {
  const dateText = fmtCatchupDate(ms, locale);
  const timeText = fmtHHmm(ms);
  if (dateText && timeText) return `${dateText} · ${timeText}`;
  return dateText || timeText;
}

function idsMatch(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  return String(a) === String(b);
}

/**
 * ID para `getCatchupM3u8` — paridad 10foot (`AppData.getTopLevelCatchupM3u8Url(event.id)`).
 * Prioridad: `id` del API, luego campos catchup explícitos; `eventId` solo como último recurso.
 */
export function getCatchupStreamId(event) {
  if (!event) return null;
  const raw =
    event.id ??
    event.catchupId ??
    event.catchup_id ??
    event.catchupEventId ??
    event.eventId ??
    null;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n <= 0) return null;
  return raw;
}

/** Alias histórico: siempre el id de streaming (no el eventId de rejilla). */
export function getCatchupId(event) {
  return getCatchupStreamId(event);
}

/**
 * Busca evento en grupos cargados (paridad getCatchupByEventId + getCatchupEvent).
 * @param {Array} groups
 * @param {string|number} lookupId — id de tile, event.id, eventId o catchupId EPG
 * @param {string|number} [epgStreamId] — opcional, acota al grupo del tile
 */
export function findCatchupEventInGroups(groups, lookupId, epgStreamId) {
  if (lookupId == null || lookupId === '') return null;
  const list = Array.isArray(groups) ? groups : [];

  for (const group of list) {
    if (epgStreamId != null && epgStreamId !== '') {
      const gid = group?.epgStreamId ?? group?.epg_stream_id;
      if (!idsMatch(gid, epgStreamId)) continue;
    }
    const events = group?.events || [];
    for (const event of events) {
      if (
        idsMatch(event?.id, lookupId) ||
        idsMatch(event?.eventId, lookupId) ||
        idsMatch(event?.catchupId, lookupId) ||
        idsMatch(event?.catchup_id, lookupId) ||
        idsMatch(event?.catchupEventId, lookupId)
      ) {
        return event;
      }
    }
  }

  for (const group of list) {
    const events = group?.events || [];
    for (const event of events) {
      if (
        idsMatch(event?.id, lookupId) ||
        idsMatch(event?.eventId, lookupId) ||
        idsMatch(event?.catchupId, lookupId) ||
        idsMatch(event?.catchup_id, lookupId) ||
        idsMatch(event?.catchupEventId, lookupId)
      ) {
        return event;
      }
    }
  }

  return null;
}

/** Clave estable para listas React. */
export function getCatchupRailItemKey(event, groupKey, index) {
  const streamId = getCatchupStreamId(event);
  const epgEventId = event?.eventId ?? event?.event_id;
  const startMs = getEventStartMs(event);
  const startPart = startMs != null ? String(startMs) : `idx-${index}`;
  const idPart =
    streamId != null
      ? `s-${streamId}`
      : epgEventId != null
        ? `e-${epgEventId}`
        : 'no-id';
  return `${groupKey}:${startPart}:${idPart}:${index}`;
}

export function getCatchupGroupKey(group, index) {
  const base =
    group?.catchupGroupId ??
    group?.catchup_group_id ??
    group?.epgStreamId ??
    group?.epg_stream_id ??
    group?.lcn ??
    group?.name ??
    'group';
  return index == null ? String(base) : `${base}__${index}`;
}

export function getCatchupGroupTitle(group, fallback = '') {
  const name = group?.name || group?.catchupGroupId || fallback;
  const lcn = group?.lcn != null && group.lcn !== '' ? `${group.lcn} · ` : '';
  return `${lcn}${name}`.trim();
}

/** Objeto canal compatible con EpgEventModal a partir del grupo catchup. */
export function catchupGroupToChannel(group) {
  if (!group) return null;
  return {
    name: group.name || group.catchupGroupId || '',
    lcn: group.lcn,
    img:
      group.img ||
      group.imageUrl ||
      group.logoUrl ||
      group.logo ||
      group.icon ||
      null,
    parentalRating: group.parentalRating,
  };
}

export function getEventEndMs(event) {
  const endRaw = event?.endDate ?? event?.end ?? event?.end_date;
  if (endRaw != null) {
    if (typeof endRaw?.valueOf === 'function') {
      const ms = endRaw.valueOf();
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof endRaw === 'number' && Number.isFinite(endRaw)) return endRaw;
    const ms = new Date(endRaw).getTime();
    if (Number.isFinite(ms)) return ms;
  }

  const startMs = getEventStartMs(event);
  const durationSeconds = Number(
    event?.durationSeconds ?? event?.duration_sec ?? event?.duration ?? 0
  );
  if (startMs != null && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return startMs + durationSeconds * 1000;
  }

  return null;
}
