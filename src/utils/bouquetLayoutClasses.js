/**
 * Slugs CSS por card_design de bouquet.
 */
const LAYOUT_SLUG_BY_TYPE = {
  service_layout_logo_normal: 'logo-normal',
  logo_normal: 'logo-normal',
  logo: 'logo-normal',

  service_layout_logo_with_number: 'logo-with-number',
  logo_with_number: 'logo-with-number',
  'logo+lcn': 'logo-with-number',

  service_layout_logo_large: 'logo-large',
  logo_large: 'logo-large',
  logo_grande: 'logo-large',
  service_layout_logo_grande: 'logo-large',

  service_layout_event_normal: 'event-normal',
  event_normal: 'event-normal',
  event: 'event-normal',

  service_layout_event_large: 'event-large',
  event_large: 'event-large',

  service_layout_event_and_logo: 'event-and-logo',
  event_and_logo: 'event-and-logo',
  'event+logo': 'event-and-logo',

  service_layout_detailed: 'detailed',
  detailed: 'detailed',

  service_layout_channel_full_info: 'channel-full-info',
  channel_full_info: 'channel-full-info',

  service_layout_event_and_logo_overlay: 'event-and-logo-overlay',
  event_and_logo_overlay: 'event-and-logo-overlay',

  service_layout_event_with_logo_top_right: 'event-logo-top-right',
  event_with_logo_top_right: 'event-logo-top-right',

  service_layout_event_with_logo_top_left: 'event-logo-top-left',
  event_with_logo_top_left: 'event-logo-top-left',

  service_layout_event_with_logo_bottom_right: 'event-logo-bottom-right',
  event_with_logo_bottom_right: 'event-logo-bottom-right',

  service_layout_event_with_logo_bottom_left: 'event-logo-bottom-left',
  event_with_logo_bottom_left: 'event-logo-bottom-left',

  service_layout_event_line: 'event-line',
  event_line: 'event-line',
  eventline: 'event-line',

  service_layout_full_width_line: 'full-width-line',
  full_width_line: 'full-width-line',

  service_layout_grid_horizontal: 'grid-horizontal',
  grid_horizontal: 'grid-horizontal',
  'grid-h': 'grid-horizontal',
  grid_h: 'grid-horizontal',

  service_layout_grid_vertical: 'grid-vertical',
  grid_vertical: 'grid-vertical',
  'grid-v': 'grid-vertical',
  grid_v: 'grid-vertical',
};

/**
 * @param {string | null | undefined} layoutType
 * @returns {string}
 */
export function getBouquetLayoutSlug(layoutType) {
  const key = String(layoutType || '')
    .toLowerCase()
    .trim();

  if (LAYOUT_SLUG_BY_TYPE[key]) {
    return LAYOUT_SLUG_BY_TYPE[key];
  }

  if (key.startsWith('service_layout_')) {
    return key.replace(/^service_layout_/, '').replace(/_/g, '-');
  }

  return 'logo-normal';
}

export function getBouquetHorizontalGridClasses(layoutType) {
  const slug = getBouquetLayoutSlug(layoutType);
  return {
    slug,
    root: `bouquet-horizontal-grid bouquet-horizontal-grid--${slug}`,
    track: `bouquet-horizontal-grid-track bouquet-horizontal-grid-track--${slug}`,
  };
}

/** @deprecated */
export function getBouquetRowCarouselClasses(layoutType) {
  const { slug, root, track } = getBouquetHorizontalGridClasses(layoutType);
  return { slug, carousel: root, track };
}

/** @deprecated */
export function getBouquetGridHorizontalClasses(layoutType) {
  return getBouquetHorizontalGridClasses(layoutType);
}

export function getBouquetGridVerticalClasses(layoutType) {
  const slug = getBouquetLayoutSlug(layoutType);
  return {
    slug,
    root: `bouquet-grid-vertical bouquet-grid-vertical--${slug}`,
    track: `bouquet-grid-vertical-content bouquet-grid-vertical-content--${slug}`,
  };
}
