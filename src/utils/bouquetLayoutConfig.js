/**
 * Parseo y resolución de layout de bouquet (customData v2: layouts por dispositivo + legacy).
 */

export const DEFAULT_CARD_DESIGN = 'service_layout_logo_normal';

/** @typedef {'horizontal_carousel' | 'horizontal_multi_row' | 'vertical_grid'} BouquetContainerType */

/** @typedef {'column' | 'row'} HorizontalGridFlow */

/**
 * @typedef {object} HorizontalGridMode
 * @property {HorizontalGridFlow} flow
 * @property {number} rows
 * @property {boolean} scrollX
 */

/**
 * @typedef {object} BouquetLayoutResolved
 * @property {BouquetContainerType} containerType
 * @property {string} cardDesign
 * @property {string} layoutType
 * @property {number} gridRows
 * @property {number} gridColumns
 * @property {string} logoIndex
 * @property {string | null} platformLayoutType
 */

/** Alias de card_design → nombre canónico service_layout_* */
const CARD_DESIGN_CANONICAL = {
  service_layout_logo_normal: 'service_layout_logo_normal',
  logo_normal: 'service_layout_logo_normal',
  logo: 'service_layout_logo_normal',

  service_layout_logo_with_number: 'service_layout_logo_with_number',
  logo_with_number: 'service_layout_logo_with_number',
  'logo+lcn': 'service_layout_logo_with_number',

  service_layout_logo_large: 'service_layout_logo_large',
  logo_large: 'service_layout_logo_large',
  logo_grande: 'service_layout_logo_large',
  service_layout_logo_grande: 'service_layout_logo_large',

  service_layout_event_normal: 'service_layout_event_normal',
  event_normal: 'service_layout_event_normal',
  event: 'service_layout_event_normal',

  service_layout_event_large: 'service_layout_event_large',
  event_large: 'service_layout_event_large',

  service_layout_event_and_logo: 'service_layout_event_and_logo',
  event_and_logo: 'service_layout_event_and_logo',
  'event+logo': 'service_layout_event_and_logo',

  service_layout_event_and_logo_overlay: 'service_layout_event_and_logo_overlay',
  event_and_logo_overlay: 'service_layout_event_and_logo_overlay',

  service_layout_event_with_logo_top_right: 'service_layout_event_and_logo_overlay',
  event_with_logo_top_right: 'service_layout_event_and_logo_overlay',

  service_layout_event_with_logo_top_left: 'service_layout_event_and_logo_overlay',
  event_with_logo_top_left: 'service_layout_event_and_logo_overlay',

  service_layout_event_with_logo_bottom_right: 'service_layout_event_and_logo_overlay',
  event_with_logo_bottom_right: 'service_layout_event_and_logo_overlay',

  service_layout_event_with_logo_bottom_left: 'service_layout_event_and_logo_overlay',
  event_with_logo_bottom_left: 'service_layout_event_and_logo_overlay',

  service_layout_event_line: 'service_layout_event_line',
  event_line: 'service_layout_event_line',
  eventline: 'service_layout_event_line',

  service_layout_full_width_line: 'service_layout_full_width_line',
  full_width_line: 'service_layout_full_width_line',

  service_layout_detailed: 'service_layout_detailed',
  detailed: 'service_layout_detailed',

  service_layout_channel_full_info: 'service_layout_channel_full_info',
  channel_full_info: 'service_layout_channel_full_info',

  service_layout_grid_horizontal: 'service_layout_grid_horizontal',
  grid_horizontal: 'service_layout_grid_horizontal',
  'grid-h': 'service_layout_grid_horizontal',
  grid_h: 'service_layout_grid_horizontal',

  service_layout_grid_vertical: 'service_layout_grid_vertical',
  grid_vertical: 'service_layout_grid_vertical',
  'grid-v': 'service_layout_grid_vertical',
  grid_v: 'service_layout_grid_vertical',
};

const VERTICAL_GRID_TYPES = new Set([
  'vertical_grid',
  'vertical-grid',
  'service_layout_grid_vertical',
  'grid_vertical',
  'grid-v',
  'grid_v',
]);

const HORIZONTAL_GRID_TYPES = new Set([
  'horizontal_grid',
  'horizontal-grid',
  'service_layout_grid_horizontal',
  'grid_horizontal',
  'grid-h',
  'grid_h',
]);

const HORIZONTAL_CAROUSEL_TYPES = new Set([
  'horizontal_carousel',
  'carousel',
  'row_carousel',
]);

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

  if (CARD_DESIGN_CANONICAL[value]) {
    return CARD_DESIGN_CANONICAL[value];
  }

  if (value.startsWith('service_layout_')) {
    return value;
  }

  return DEFAULT_CARD_DESIGN;
}

/**
 * @param {{ isTV?: boolean; isPC?: boolean }} [device]
 * @returns {'tv' | 'desktop' | 'mobile'}
 */
export function getDeviceLayoutKey(device = {}) {
  if (device.isTV) return 'tv';
  if (device.isPC) return 'desktop';
  return 'mobile';
}

/**
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isVerticalGridPlatformType(type) {
  return VERTICAL_GRID_TYPES.has(String(type || '').toLowerCase().trim());
}

/**
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isHorizontalGridPlatformType(type) {
  return HORIZONTAL_GRID_TYPES.has(String(type || '').toLowerCase().trim());
}

/**
 * @param {number | null | undefined} columns
 * @returns {number}
 */
export function resolveVerticalGridColumns(columns) {
  const n = Number(columns);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 1;
}

/**
 * @param {number | null | undefined} rows
 * @returns {number}
 */
export function resolveHorizontalGridRows(rows) {
  const n = Number(rows);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 6);
  return 1;
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
  const rows = resolveHorizontalGridRows(entry.rows);
  let containerType = 'horizontal_carousel';
  let gridRows = rows;

  if (isVerticalGridPlatformType(type)) {
    containerType = 'vertical_grid';
    gridRows = rows;
  } else if (isHorizontalGridPlatformType(type)) {
    if (rows > 1) {
      containerType = 'horizontal_multi_row';
      gridRows = rows;
    } else {
      containerType = 'horizontal_carousel';
      gridRows = 1;
    }
  } else if (HORIZONTAL_CAROUSEL_TYPES.has(type)) {
    containerType = 'horizontal_carousel';
    gridRows = 1;
  } else {
    const card = entry.cardDesign;
    if (card === 'service_layout_grid_horizontal') {
      containerType = rows > 1 ? 'horizontal_multi_row' : 'horizontal_carousel';
      gridRows = rows;
    } else if (card === 'service_layout_grid_vertical') {
      containerType = 'vertical_grid';
    } else if (rows > 1) {
      containerType = 'horizontal_multi_row';
      gridRows = rows;
    }
  }

  const cardDesign =
    entry.cardDesign === 'service_layout_grid_horizontal' ||
    entry.cardDesign === 'service_layout_grid_vertical'
      ? DEFAULT_CARD_DESIGN
      : entry.cardDesign;

  const gridColumns =
    containerType === 'vertical_grid' ? resolveVerticalGridColumns(entry.columns) : null;

  return {
    containerType,
    cardDesign,
    layoutType: cardDesign,
    gridRows,
    gridColumns,
    logoIndex: entry.logoIndex,
    platformLayoutType: type,
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
      gridColumns: 1,
      logoIndex: '1',
      platformLayoutType: 'service_layout_grid_horizontal',
    };
  }

  if (normalized === 'service_layout_grid_vertical') {
    return {
      containerType: 'vertical_grid',
      cardDesign: DEFAULT_CARD_DESIGN,
      layoutType: DEFAULT_CARD_DESIGN,
      gridRows: 1,
      gridColumns: 1,
      logoIndex: '1',
      platformLayoutType: 'service_layout_grid_vertical',
    };
  }

  return {
    containerType: 'horizontal_carousel',
    cardDesign: normalized,
    layoutType: normalized,
    gridRows: 1,
    gridColumns: 1,
    logoIndex: '1',
    platformLayoutType: null,
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} layouts
 * @param {'tv' | 'desktop' | 'mobile'} [deviceKey]
 */
export function pickPlatformLayoutEntry(layouts, deviceKey = 'tv') {
  if (!layouts || typeof layouts !== 'object') return null;

  const key = String(deviceKey || 'tv').toLowerCase();
  let entry = null;

  if (key === 'tv') {
    entry = layouts.tv;
  } else if (key === 'desktop') {
    entry = layouts.desktop ?? layouts.tv ?? layouts.mobile ?? layouts.tablet;
  } else if (key === 'mobile') {
    entry = layouts.mobile ?? layouts.tablet ?? layouts.desktop ?? layouts.tv;
  }

  if (!entry || typeof entry !== 'object') {
    entry = layouts.tv ?? layouts.desktop ?? layouts.mobile ?? layouts.tablet;
  }

  if (!entry || typeof entry !== 'object') return null;
  return normalizePlatformEntry(entry);
}

/**
 * @param {{ bouquetLayouts?: Record<string, unknown> | null; layoutType?: string; customData?: * }} bouquet
 * @param {{ isTV?: boolean; isPC?: boolean }} [device]
 * @returns {BouquetLayoutResolved}
 */
export function resolveBouquetLayoutForDevice(bouquet, device = {}) {
  const deviceKey = getDeviceLayoutKey(device);

  const entry = pickPlatformLayoutEntry(bouquet?.bouquetLayouts, deviceKey);
  if (entry) {
    return platformEntryToResolved(entry);
  }

  if (bouquet?.customData) {
    const parsed = parseBouquetCustomData(bouquet.customData);
    if (parsed.format === 'platform' && parsed.layouts) {
      const fromCustom = pickPlatformLayoutEntry(parsed.layouts, deviceKey);
      if (fromCustom) {
        return platformEntryToResolved(fromCustom);
      }
    }
  }

  return legacyLayoutTypeToResolved(bouquet?.layoutType || DEFAULT_CARD_DESIGN);
}

/**
 * Variante interna de tarjeta para CSS y render (`channel-card--*`).
 * @param {string | null | undefined} cardDesign
 * @returns {string}
 */
export function getChannelLayoutVariant(cardDesign) {
  if (!cardDesign) return 'logo';
  const value = String(cardDesign).toLowerCase();

  if (
    value === 'service_layout_logo_normal' ||
    value === 'logo_normal' ||
    value === 'logo' ||
    value === 'service_layout_logo_large' ||
    value === 'logo_large' ||
    value === 'logo_grande' ||
    value === 'service_layout_logo_grande'
  ) {
    return 'logo';
  }
  if (
    value === 'service_layout_logo_with_number' ||
    value === 'logo_with_number' ||
    value === 'logo+lcn'
  ) {
    return 'logo_with_number';
  }
  if (
    value === 'service_layout_channel_full_info' ||
    value === 'channel_full_info'
  ) {
    return 'logo_with_number';
  }
  if (
    value === 'service_layout_detailed' ||
    value === 'detailed'
  ) {
    return 'event_and_logo';
  }
  if (
    value === 'service_layout_event_normal' ||
    value === 'event_normal' ||
    value === 'event'
  ) {
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
    value === 'event_and_logo_overlay' ||
    value === 'service_layout_event_with_logo_top_right' ||
    value === 'event_with_logo_top_right' ||
    value === 'service_layout_event_with_logo_top_left' ||
    value === 'event_with_logo_top_left' ||
    value === 'service_layout_event_with_logo_bottom_right' ||
    value === 'event_with_logo_bottom_right' ||
    value === 'service_layout_event_with_logo_bottom_left' ||
    value === 'event_with_logo_bottom_left'
  ) {
    return 'event_and_logo_overlay';
  }
  if (
    value === 'service_layout_event_line' ||
    value === 'event_line' ||
    value === 'eventline' ||
    value === 'service_layout_event_large' ||
    value === 'event_large' ||
    value === 'service_layout_full_width_line' ||
    value === 'full_width_line'
  ) {
    return 'event_line';
  }

  return 'logo';
}

/**
 * Modo de render horizontal según customData (type, rows, card_design legacy).
 * @param {BouquetContainerType | string} containerType
 * @param {string | null | undefined} cardDesign
 * @param {number | null | undefined} gridRows
 * @param {string | null | undefined} [platformLayoutType]
 * @returns {HorizontalGridMode}
 */
export function resolveHorizontalGridMode(
  containerType,
  cardDesign,
  gridRows,
  platformLayoutType = null
) {
  const rows = resolveHorizontalGridRows(gridRows);
  const rawType = String(platformLayoutType || '').toLowerCase().trim();

  if (containerType === 'horizontal_multi_row' && rows > 1) {
    return { flow: 'column', rows, scrollX: true };
  }

  if (isHorizontalGridPlatformType(rawType)) {
    return { flow: 'column', rows: rows > 1 ? rows : 1, scrollX: true };
  }

  if (HORIZONTAL_CAROUSEL_TYPES.has(rawType)) {
    return { flow: 'column', rows: 1, scrollX: true };
  }

  if (
    platformLayoutType == null &&
    containerType === 'horizontal_carousel' &&
    getChannelLayoutVariant(cardDesign) === 'logo_with_number'
  ) {
    return { flow: 'row', rows: 1, scrollX: false };
  }

  if (containerType === 'horizontal_carousel') {
    return { flow: 'column', rows: 1, scrollX: true };
  }

  return { flow: 'column', rows: 1, scrollX: true };
}

/**
 * @param {*} channel
 * @param {string} [baseUrl]
 * @param {string} [logoIndex]
 * @returns {string | null}
 */
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
