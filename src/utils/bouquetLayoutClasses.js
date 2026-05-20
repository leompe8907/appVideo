/**
 * Slugs CSS por tipo de layout de bouquet (carrusel / grid).
 * Se usan como modificadores: `.horizontal-slide--{slug}`, `.bouquet-row-carousel--{slug}`.
 */
const LAYOUT_SLUG_BY_TYPE = {
  service_layout_logo_normal: 'logo-normal',
  logo_normal: 'logo-normal',
  logo: 'logo-normal',

  service_layout_logo_with_number: 'logo-with-number',
  logo_with_number: 'logo-with-number',
  'logo+lcn': 'logo-with-number',

  service_layout_event_normal: 'event-normal',
  event_normal: 'event-normal',
  event: 'event-normal',

  service_layout_event_and_logo: 'event-and-logo',
  event_and_logo: 'event-and-logo',
  'event+logo': 'event-and-logo',

  service_layout_event_and_logo_overlay: 'event-and-logo-overlay',
  event_and_logo_overlay: 'event-and-logo-overlay',

  service_layout_event_line: 'event-line',
  event_line: 'event-line',
  eventline: 'event-line',

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
  return LAYOUT_SLUG_BY_TYPE[key] || 'logo-normal';
}

/**
 * Clases del carrusel en fila (BouquetRowCarousel).
 * @param {string | null | undefined} layoutType
 * @returns {{ carousel: string; track: string; slug: string }}
 */
export function getBouquetRowCarouselClasses(layoutType) {
  const slug = getBouquetLayoutSlug(layoutType);
  return {
    slug,
    carousel: `bouquet-row-carousel bouquet-row-carousel--${slug}`,
    track: `horizontal-slide horizontal-slide--${slug}`,
  };
}

/**
 * Clases del grid horizontal (3 filas con scroll horizontal cada una).
 * @param {string | null | undefined} layoutType
 * @returns {{ root: string; track: string; slug: string }}
 */
export function getBouquetGridHorizontalClasses(layoutType) {
  const slug = getBouquetLayoutSlug(layoutType);
  return {
    slug,
    root: `bouquet-grid-horizontal bouquet-grid-horizontal--${slug}`,
    track: `horizontal-slide horizontal-slide--grid-row horizontal-slide--${slug}`,
  };
}

/**
 * Clases del grid vertical (columnas fijas).
 * Mantiene `.bouquet-grid-vertical-content` para navegación TV.
 * @param {string | null | undefined} layoutType
 * @returns {{ root: string; track: string; slug: string }}
 */
export function getBouquetGridVerticalClasses(layoutType) {
  const slug = getBouquetLayoutSlug(layoutType);
  return {
    slug,
    root: `bouquet-grid-vertical bouquet-grid-vertical--${slug}`,
    track: `bouquet-grid-vertical-content bouquet-grid-vertical-content--${slug}`,
  };
}
