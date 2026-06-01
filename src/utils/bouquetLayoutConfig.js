/**
 * Parseo y resolución de layout de bouquet (customData v2: layouts.tv en PC y TV + legacy).
 */

export const DEFAULT_CARD_DESIGN = 'service_layout_logo_normal';

/** @typedef {'horizontal_carousel' | 'horizontal_multi_row' | 'vertical_grid'} BouquetContainerType */

/**
 * @typedef {object} BouquetLayoutResolved
 * @property {BouquetContainerType} containerType
 * @property {string} cardDesign
 * @property {string} layoutType - alias de cardDesign (compat)
 * @property {number} gridRows
 * @property {number | null} gridColumns
 * @property {string} logoIndex
 */

/**
 * @param {*} customData
 * @returns {object | null}
 */
export function parseCustomDataToObject(customData) {
  if (!customData) return null;
  if (typeof customData === 'object' && !Array.isArray(customData)) {
    return customData;
  }
  if (typeof customData === 'string') {
    const trimmed = customData.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return { layout: trimmed };
      }
    }
    return { layout: trimmed };
  }
  return null;
}

/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeCardDesign(raw) {
  if (!raw) return DEFAULT_CARD_DESIGN;
  const value = String(raw).toLowerCase().trim();

  if (value === 'service_layout_logo_normal' || value === 'logo_normal' || value === 'logo') {
    return 'service_layout_logo_normal';
  }
  if (
    value === 'service_layout_logo_with_number' ||
    value === 'logo_with_number' ||
    value === 'logo+lcn'
  ) {
    return 'service_layout_logo_with_number';
  }
  if (value === 'service_layout_event_normal' || value === 'event_normal' || value === 'event') {
    return 'service_layout_event_normal';
  }
  if (
    value === 'service_layout_event_and_logo' ||
    value === 'event_and_logo' ||
    value === 'event+logo'
  ) {
    return 'service_layout_event_and_logo';
  }
  if (
    value === 'service_layout_event_and_logo_overlay' ||
    value === 'event_and_logo_overlay'
  ) {
    return 'service_layout_event_and_logo_overlay';
  }
  if (value === 'service_layout_event_line' || value === 'event_line' || value === 'eventline') {
    return 'service_layout_event_line';
  }
  if (
    value === 'service_layout_grid_horizontal' ||
    value === 'grid_horizontal' ||
    value === 'grid-h' ||
    value === 'grid_h'
  ) {
    return 'service_layout_grid_horizontal';
  }
  if (
    value === 'service_layout_grid_vertical' ||
    value === 'grid_vertical' ||
    value === 'grid-v' ||
    value === 'grid_v'
  ) {
    return 'service_layout_grid_vertical';
  }

  return DEFAULT_CARD_DESIGN;
}

/**
 * @param {*} entry
 * @returns {{ type: string; cardDesign: string; rows: number; columns: number | null; logoIndex: string }}
 */
function normalizePlatformEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return {
      type: 'horizontal_grid',
      cardDesign: DEFAULT_CARD_DESIGN,
      rows: 1,
      columns: null,
      logoIndex: '1',
    };
  }

  const type = String(entry.type ?? entry.containerType ?? 'horizontal_grid')
    .toLowerCase()
    .trim();

  const cardRaw =
    entry.card_design ??
    entry.cardDesign ??
    entry.serviceLayout ??
    entry.service_layout ??
    entry.layout ??
    entry.design;

  const rowsRaw = entry.rows ?? entry.rowCount;
  let rows = 1;
  if (rowsRaw != null && rowsRaw !== '') {
    const n = Number(rowsRaw);
    if (Number.isFinite(n) && n > 0) rows = Math.floor(n);
  }

  const columnsRaw = entry.columns ?? entry.columnCount;
  let columns = null;
  if (columnsRaw != null && columnsRaw !== '') {
    const n = Number(columnsRaw);
    if (Number.isFinite(n) && n > 0) columns = Math.floor(n);
  }

  const logoIndex = String(entry.logo_index ?? entry.logoIndex ?? '1').trim() || '1';

  return {
    type,
    cardDesign: normalizeCardDesign(cardRaw),
    rows,
    columns,
    logoIndex,
  };
}

/**
 * @param {Record<string, unknown>} layouts
 * @returns {Record<string, ReturnType<typeof normalizePlatformEntry>>}
 */
function normalizePlatformLayouts(layouts) {
  const out = {};
  if (!layouts || typeof layouts !== 'object') return out;

  for (const key of Object.keys(layouts)) {
    const entry = layouts[key];
    if (entry && typeof entry === 'object') {
      out[key] = normalizePlatformEntry(entry);
    }
  }
  return out;
}

/**
 * Extrae layout legacy (un solo valor) del objeto customData plano.
 * @param {object | null} obj
 * @returns {string}
 */
function extractLegacyLayoutFromObject(obj) {
  if (!obj) return DEFAULT_CARD_DESIGN;

  const rawLayout =
    obj.serviceLayout ??
    obj.service_layout ??
    obj.layout ??
    obj.design ??
    obj.type ??
    null;

  if (!rawLayout) return DEFAULT_CARD_DESIGN;
  return normalizeCardDesign(rawLayout);
}

/**
 * @param {*} customData
 * @returns {{ format: 'platform' | 'legacy'; layouts: Record<string, ReturnType<typeof normalizePlatformEntry>> | null; legacyCardDesign: string }}
 */
export function parseBouquetCustomData(customData) {
  const obj = parseCustomDataToObject(customData);

  if (obj?.layouts && typeof obj.layouts === 'object') {
    return {
      format: 'platform',
      layouts: normalizePlatformLayouts(obj.layouts),
      legacyCardDesign: DEFAULT_CARD_DESIGN,
    };
  }

  if (typeof customData === 'string' && !customData.trim().startsWith('{')) {
    return {
      format: 'legacy',
      layouts: null,
      legacyCardDesign: normalizeCardDesign(customData),
    };
  }

  return {
    format: 'legacy',
    layouts: null,
    legacyCardDesign: extractLegacyLayoutFromObject(obj),
  };
}

/**
 * @param {ReturnType<typeof normalizePlatformEntry>} entry
 * @returns {BouquetLayoutResolved}
 */
function platformEntryToResolved(entry) {
  const type = entry.type;
  let containerType = 'horizontal_carousel';
  let gridRows = 1;

  if (
    type === 'vertical_grid' ||
    type === 'vertical-grid' ||
    type === 'service_layout_grid_vertical' ||
    type === 'grid_vertical' ||
    type === 'grid-v' ||
    type === 'grid_v'
  ) {
    containerType = 'vertical_grid';
    gridRows = entry.rows > 0 ? entry.rows : 1;
  } else if (
    type === 'service_layout_grid_horizontal' ||
    type === 'grid_horizontal' ||
    type === 'grid-h' ||
    type === 'grid_h'
  ) {
    containerType = 'horizontal_multi_row';
    gridRows = entry.rows > 1 ? entry.rows : 3;
  } else if (type === 'horizontal_grid' || type === 'horizontal-grid') {
    if (entry.rows > 1) {
      containerType = 'horizontal_multi_row';
      gridRows = entry.rows;
    } else {
      containerType = 'horizontal_carousel';
      gridRows = 1;
    }
  } else if (
    type === 'horizontal_carousel' ||
    type === 'carousel' ||
    type === 'row_carousel'
  ) {
    containerType = 'horizontal_carousel';
    gridRows = 1;
  } else {
    const card = entry.cardDesign;
    if (card === 'service_layout_grid_horizontal') {
      containerType = 'horizontal_multi_row';
      gridRows = entry.rows > 1 ? entry.rows : 3;
    } else if (card === 'service_layout_grid_vertical') {
      containerType = 'vertical_grid';
    } else if (entry.rows > 1) {
      containerType = 'horizontal_multi_row';
      gridRows = entry.rows;
    }
  }

  const cardDesign =
    entry.cardDesign === 'service_layout_grid_horizontal' ||
    entry.cardDesign === 'service_layout_grid_vertical'
      ? DEFAULT_CARD_DESIGN
      : entry.cardDesign;

  return {
    containerType,
    cardDesign,
    layoutType: cardDesign,
    gridRows,
    gridColumns: entry.columns,
    logoIndex: entry.logoIndex,
  };
}

/**
 * @param {string} legacyType
 * @returns {BouquetLayoutResolved}
 */
export function legacyLayoutTypeToResolved(legacyType) {
  const normalized = normalizeCardDesign(legacyType);

  if (normalized === 'service_layout_grid_horizontal') {
    return {
      containerType: 'horizontal_multi_row',
      cardDesign: DEFAULT_CARD_DESIGN,
      layoutType: DEFAULT_CARD_DESIGN,
      gridRows: 3,
      gridColumns: null,
      logoIndex: '1',
    };
  }

  if (normalized === 'service_layout_grid_vertical') {
    return {
      containerType: 'vertical_grid',
      cardDesign: DEFAULT_CARD_DESIGN,
      layoutType: DEFAULT_CARD_DESIGN,
      gridRows: 1,
      gridColumns: null,
      logoIndex: '1',
    };
  }

  return {
    containerType: 'horizontal_carousel',
    cardDesign: normalized,
    layoutType: normalized,
    gridRows: 1,
    gridColumns: null,
    logoIndex: '1',
  };
}

/**
 * Entrada de layout de plataforma: siempre `tv` (PC y TV usan el mismo bloque).
 * @param {Record<string, unknown> | null | undefined} layouts
 * @returns {ReturnType<typeof normalizePlatformEntry> | null}
 */
export function pickPlatformLayoutEntry(layouts) {
  if (!layouts || typeof layouts !== 'object') return null;
  const entry = layouts.tv ?? layouts.mobile ?? layouts.tablet ?? layouts.desktop;
  if (!entry || typeof entry !== 'object') return null;
  return normalizePlatformEntry(entry);
}

/**
 * Resuelve layout activo del bouquet (customData v2: siempre `layouts.tv` en PC y TV).
 * @param {{ bouquetLayouts?: Record<string, unknown> | null; layoutType?: string; customData?: * }} bouquet
 * @returns {BouquetLayoutResolved}
 */
export function resolveBouquetLayoutForDevice(bouquet) {
  const entry = pickPlatformLayoutEntry(bouquet?.bouquetLayouts);
  if (entry) {
    return platformEntryToResolved(entry);
  }

  if (bouquet?.customData) {
    const parsed = parseBouquetCustomData(bouquet.customData);
    if (parsed.format === 'platform' && parsed.layouts) {
      const fromCustom = pickPlatformLayoutEntry(parsed.layouts);
      if (fromCustom) {
        return platformEntryToResolved(fromCustom);
      }
    }
  }

  return legacyLayoutTypeToResolved(bouquet?.layoutType || DEFAULT_CARD_DESIGN);
}

/**
 * URL de thumb del logo según logo2id y logo_index (carpeta v, v2, …).
 * @param {*} channel
 * @param {string} [baseUrl]
 * @param {string} [logoIndex]
 * @returns {string | null}
 */
/**
 * Variante interna de tarjeta para CSS (`channel-card--*`).
 * @param {string | null | undefined} cardDesign
 * @returns {string}
 */
export function getChannelLayoutVariant(cardDesign) {
  if (!cardDesign) return 'logo';
  const value = String(cardDesign).toLowerCase();

  if (value === 'service_layout_logo_normal' || value === 'logo_normal' || value === 'logo') {
    return 'logo';
  }
  if (
    value === 'service_layout_logo_with_number' ||
    value === 'logo_with_number' ||
    value === 'logo+lcn'
  ) {
    return 'logo_with_number';
  }
  if (value === 'service_layout_event_normal' || value === 'event_normal' || value === 'event') {
    return 'event';
  }
  if (
    value === 'service_layout_event_and_logo' ||
    value === 'event_and_logo' ||
    value === 'event+logo'
  ) {
    return 'event_and_logo';
  }
  if (
    value === 'service_layout_event_and_logo_overlay' ||
    value === 'event_and_logo_overlay'
  ) {
    return 'event_and_logo_overlay';
  }
  if (value === 'service_layout_event_line' || value === 'event_line' || value === 'eventline') {
    return 'event_line';
  }

  return 'logo';
}

export function buildChannelLogoUrl(channel, baseUrl, logoIndex = '1') {
  if (!channel) return null;

  const idx = String(logoIndex || '1').trim();
  const logo2id =
    channel.logo2id ?? channel.logo2Id ?? channel.logo2ID ?? channel.logo_2_id;
  if (!logo2id) return null;

  const versionFolder = idx === '1' ? 'v' : `v${idx}`;
  const path = `/cdn/public/images/${logo2id}/${versionFolder}/thumb.png`;
  const base = typeof baseUrl === 'string' ? baseUrl.replace(/\/$/, '') : '';
  return base ? `${base}${path}` : path;
}
