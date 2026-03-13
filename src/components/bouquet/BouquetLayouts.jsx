import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

// --- Helpers EPG para layout event_and_logo ---
/** Parsea "YYYY-MM-DD HH:mm:ss" a "HH:mm" para mostrar en UI */
function formatEpgTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Devuelve el evento EPG que está al aire ahora (now entre start y end).
 * - Si ahora está dentro de un evento → ese evento (barra avanza en tiempo real).
 * - Si ahora es antes del primer evento → primer evento (barra en 0%).
 * - Si ahora es después del último evento → último evento (barra en 100%, imagen e info del último programa).
 * Así la barra y la imagen se actualizan solas cuando cambia el evento.
 */
function getCurrentEpgEvent(epgItems) {
  if (!Array.isArray(epgItems) || epgItems.length === 0) return null;
  const now = Date.now();
  let lastValid = null;
  for (const event of epgItems) {
    const startMs = event.startDate?.valueOf?.() ?? new Date(event.start).getTime();
    const endMs = event.endDate?.valueOf?.() ?? new Date(event.end).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
    lastValid = event;
    if (now >= startMs && now <= endMs) return event;
    if (now < startMs) return lastValid ?? event; // aún no empieza → mostrar el que viene (barra 0%)
  }
  return lastValid ?? epgItems[0] ?? null; // ya pasó todo → último evento (barra 100%)
}

/** Progreso 0–100 del evento actual (para la barra). start/end como string o con startDate/endDate */
function getEpgEventProgressPercent(event) {
  if (!event) return 0;
  const now = Date.now();
  const startMs = event.startDate?.valueOf?.() ?? new Date(event.start).getTime();
  const endMs = event.endDate?.valueOf?.() ?? new Date(event.end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0;
  const p = ((now - startMs) / (endMs - startMs)) * 100;
  return Math.min(100, Math.max(0, p));
}

/** Título del evento desde languages[0].title o campo directo */
function getEpgEventTitle(event) {
  if (!event) return '';
  if (event.languages?.[0]?.title) return event.languages[0].title;
  return event.title ?? '';
}

// Helper local para normalizar colores (copia ligera del usado en Bouquet.jsx)
function normalizeColor(color) {
  if (!color || typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.length === 3 || trimmed.length === 6) {
    return `#${trimmed}`;
  }
  return null;
}

/**
 * Construye la URL del logo de canal a partir de logo2id.
 * Si no se puede construir, se devuelve null y se usará la ruta de img.
 */
function buildLogoUrlFromLogo2Id(channel) {
  if (!channel) return null;
  const logo2id =
    channel.logo2id ?? channel.logo2Id ?? channel.logo2ID ?? channel.logo_2_id;
  if (!logo2id) return null;

  // Ruta estándar: cdn/public/images/(logo2id)/v/thumb.png
  return `/cdn/public/images/${logo2id}/v/thumb.png`;
}

/**
 * Normaliza el tipo de layout de canal a una variante interna simple.
 * Entradas esperadas: service_layout_logo_normal, service_layout_event_normal, etc.
 */
function getChannelLayoutVariant(layoutType) {
  if (!layoutType) return 'logo';
  const value = String(layoutType).toLowerCase();

  if (value === 'service_layout_logo_normal' || value === 'logo_normal' || value === 'logo') {
    return 'logo';
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
    value === 'event_and_logo_overlay'
  ) {
    return 'event_and_logo_overlay';
  }
  if (
    value === 'service_layout_event_line' ||
    value === 'event_line' ||
    value === 'eventline'
  ) {
    return 'event_line';
  }

  // Para layouts grid, el contenido de la tarjeta puede seguir siendo el estándar de logo
  if (
    value === 'service_layout_grid_horizontal' ||
    value === 'grid_horizontal' ||
    value === 'grid-h'
  ) {
    return 'logo';
  }
  if (
    value === 'service_layout_grid_vertical' ||
    value === 'grid_vertical' ||
    value === 'grid-v'
  ) {
    return 'logo';
  }

  return 'logo';
}

/**
 * Diseño tipo 10foot: fila horizontal de canales por bouquet.
 * Espera un objeto bouquet con:
 * - bouquet.bouquetId
 * - bouquet.name / description
 * - bouquet.items: array de canales { id, name, img, lcn, backgroundColor, ... }
 */
export function BouquetRowCarousel({ bouquet, onChannelSelect, layoutType }) {
  const { t } = useTranslation();
  const title =
    bouquet?.name ??
    bouquet?.title ??
    bouquet?.Name ??
    bouquet?.Title ??
    t('bouquet.unknown');

  const items = Array.isArray(bouquet?.items) ? bouquet.items : [];
  if (items.length === 0) return null;

  return (
    <div
      className="bouquet-row-carousel"
      data-bouquet-id={bouquet.bouquetId ?? bouquet.id ?? ''}
    >
      <h4 className="bouquet-heading">{title}</h4>
      <div className="horizontal-slide">
        {items.map((channel, index) => (
          <ChannelCard
            key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
            channel={channel}
            index={index}
            layoutType={layoutType}
            onSelect={() => onChannelSelect?.(channel, bouquet)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Tarjeta de canal. Su diseño concreto depende de la variante:
 * - logo: solo logo del canal
 * - event: imagen del evento (o logo si no hay)
 * - event_and_logo: logo arriba + imagen de evento abajo + barra de tiempo (timeship)
 * - event_line: igual que event pero con tamaño mayor
 */
function ChannelCard({ channel, index, layoutType, onSelect }) {
  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    focusKey: `channel-${channel.id ?? index}`,
    isFocusable: true,
  });

  const bgColor = normalizeColor(channel.backgroundColor ?? channel.bgColor);
  const variant = getChannelLayoutVariant(layoutType);
  const style =
    variant === 'event_and_logo' ? {} : bgColor ? { backgroundColor: bgColor } : {};

  // EPG: evento actual al aire (para event_and_logo)
  const epgItems = channel.epgItems ?? [];
  const currentEpgEvent = getCurrentEpgEvent(epgItems);
  const eventTitle = getEpgEventTitle(currentEpgEvent);
  const eventStartTime = formatEpgTime(currentEpgEvent?.start);
  const eventEndTime = formatEpgTime(currentEpgEvent?.end);
  const eventImageFromEpg =
    currentEpgEvent?.imageUrl ||
    currentEpgEvent?.imageUrl2 ||
    currentEpgEvent?.catchupImageUrl ||
    null;

  const [timeshipPercent, setTimeshipPercent] = useState(() =>
    getEpgEventProgressPercent(currentEpgEvent)
  );
  const epgItemsRef = useRef(epgItems);
  epgItemsRef.current = epgItems;
  useEffect(() => {
    if (variant !== 'event_and_logo' && variant !== 'event_and_logo_overlay') return;
    const tick = () => {
      const event = getCurrentEpgEvent(epgItemsRef.current);
      setTimeshipPercent(getEpgEventProgressPercent(event));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [variant]);

  // Placeholder cuando ni evento ni logo cargan (imagen de canal dañada o ausente)
  const { currentBrand, getImage } = useBrand();
  const placeholderImageUrl =
    currentBrand?.assets?.placeholder || getImage?.('placeholder_220x160.png') || '';

  // Imagen de evento: EPG primero, luego fallbacks. Cadena: evento → logo → placeholder
  const eventImage = eventImageFromEpg || channel.eventImage || channel.currentEvent?.image || null;
  const fallbackLogoImage = channel.img || null;
  const initialLogoUrl = buildLogoUrlFromLogo2Id(channel) || fallbackLogoImage;
  const [logoImage, setLogoImage] = useState(initialLogoUrl);
  const [eventImageFailed, setEventImageFailed] = useState(false);

  useEffect(() => {
    setEventImageFailed(false);
  }, [currentEpgEvent?.event_id]);

  const handleLogoError = () => {
    if (fallbackLogoImage && logoImage !== fallbackLogoImage) {
      setLogoImage(fallbackLogoImage);
    } else if (placeholderImageUrl) {
      setLogoImage(placeholderImageUrl);
    }
  };

  const handleEventImageError = () => {
    setEventImageFailed(true);
  };

  // Cadena: imagen de evento → logo del canal → placeholder (si evento o logo faltan/fallan)
  const effectiveEventImage =
    eventImage && !eventImageFailed ? eventImage : (logoImage || placeholderImageUrl || '');

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (import.meta.env?.DEV) {
      console.log('[ChannelCard] click', channel?.id ?? channel?.lcn);
    }
    onSelect?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.();
    }
  };

  return (
    <div
      ref={ref}
      className={`channel-card channel-card--${variant} ${focused ? 'focused' : ''}`}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isTV ? -1 : 0}
      role="button"
      data-lcn={channel.lcn}
      data-id={channel.id}
    >
      {variant === 'event_and_logo' ? (
        <>
          <div className="channel-card-frame">
            {(logoImage || placeholderImageUrl) && (
              <div className="channel-card-logo-top">
                <img
                  src={logoImage || placeholderImageUrl}
                  alt={channel.name || ''}
                  className="channel-card-logo-img"
                  onError={handleLogoError}
                />
              </div>
            )}
            <div className="channel-card-event-block">
              <img
                key={currentEpgEvent?.event_id ?? `channel-${channel.id ?? ''}`}
                src={effectiveEventImage}
                alt={eventTitle || channel.name || ''}
                className="channel-card-event-img"
                onError={eventImage ? handleEventImageError : handleLogoError}
              />
              <div className="channel-card-event-info">
                <div className="channel-timeship">
                  <div
                    className="channel-timeship-progress"
                    style={{ width: `${timeshipPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          {(eventStartTime || eventEndTime || eventTitle) && (
            <div className="channel-card-event-time-below">
              {(eventStartTime || eventEndTime) && (
                <span className="channel-card-event-time">
                  {eventStartTime}
                  {eventStartTime && eventEndTime ? ' – ' : ''}
                  {eventEndTime}
                </span>
              )}
              {eventTitle && (
                <span className="channel-card-event-title" title={eventTitle}>
                  {eventTitle}
                </span>
              )}
            </div>
          )}
        </>
      ) : variant === 'event_and_logo_overlay' ? (
        <>
          {(logoImage || placeholderImageUrl) && (
            <div className="channel-card-logo-top">
              <img
                src={logoImage || placeholderImageUrl}
                alt={channel.name || ''}
                className="channel-card-logo-img"
                onError={handleLogoError}
              />
            </div>
          )}
          <div className="channel-card-event-block">
            <img
              key={currentEpgEvent?.event_id ?? `channel-${channel.id ?? ''}`}
              src={effectiveEventImage}
              alt={eventTitle || channel.name || ''}
              className="channel-card-event-img"
              onError={eventImage ? handleEventImageError : handleLogoError}
            />
            <div className="channel-card-event-info">
              {(eventStartTime || eventEndTime || eventTitle) && (
                <div className="channel-card-event-meta">
                  {(eventStartTime || eventEndTime) && (
                    <span className="channel-card-event-time">
                      {eventStartTime}
                      {eventStartTime && eventEndTime ? ' – ' : ''}
                      {eventEndTime}
                    </span>
                  )}
                  {eventTitle && (
                    <span className="channel-card-event-title" title={eventTitle}>
                      {eventTitle}
                    </span>
                  )}
                </div>
              )}
              <div className="channel-timeship">
                <div
                  className="channel-timeship-progress"
                  style={{ width: `${timeshipPercent}%` }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <img
            src={
              variant === 'event' || variant === 'event_line'
                ? effectiveEventImage
                : (logoImage || placeholderImageUrl)
            }
            alt={channel.name || ''}
            className="channel-card-img"
            onError={
              variant === 'event' || variant === 'event_line'
                ? (eventImage && !eventImageFailed ? handleEventImageError : handleLogoError)
                : handleLogoError
            }
          />
        </>
      )}
    </div>
  );
}

/**
 * Layout de tipo grid horizontal: 3 filas de canales que se desplazan en horizontal
 * de izquierda a derecha para un mismo bouquet.
 */
export function BouquetGridHorizontal({ bouquet, onChannelSelect, layoutType }) {
  const { t } = useTranslation();
  const title =
    bouquet?.name ??
    bouquet?.title ??
    bouquet?.Name ??
    bouquet?.Title ??
    t('bouquet.unknown');

  const items = Array.isArray(bouquet?.items) ? bouquet.items : [];
  if (items.length === 0) return null;

  const rows = [[], [], []];
  items.forEach((channel, index) => {
    const rowIndex = index % 3;
    rows[rowIndex].push({ channel, index });
  });

  return (
    <div
      className="bouquet-grid-horizontal"
      data-bouquet-id={bouquet.bouquetId ?? bouquet.id ?? ''}
    >
      <h4 className="bouquet-heading">{title}</h4>
      <div className="bouquet-grid-horizontal-rows">
        {rows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="horizontal-slide horizontal-slide--grid-row"
          >
            {row.map(({ channel, index }) => (
              <ChannelCard
                key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
                channel={channel}
                index={index}
                layoutType={layoutType}
                onSelect={() => onChannelSelect?.(channel, bouquet)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Layout de tipo grid vertical: N columnas de canales que se desplazan
 * de arriba hacia abajo.
 */
export function BouquetGridVertical({ bouquet, onChannelSelect, layoutType }) {
  const { t } = useTranslation();
  const title =
    bouquet?.name ??
    bouquet?.title ??
    bouquet?.Name ??
    bouquet?.Title ??
    t('bouquet.unknown');

  const items = Array.isArray(bouquet?.items) ? bouquet.items : [];
  if (items.length === 0) return null;

  return (
    <div
      className="bouquet-grid-vertical"
      data-bouquet-id={bouquet.bouquetId ?? bouquet.id ?? ''}
    >
      <h4 className="bouquet-heading">{title}</h4>
      <div className="bouquet-grid-vertical-content">
        {items.map((channel, index) => (
          <ChannelCard
            key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
            channel={channel}
            index={index}
            layoutType={layoutType}
            onSelect={() => onChannelSelect?.(channel, bouquet)}
          />
        ))}
      </div>
    </div>
  );
}

