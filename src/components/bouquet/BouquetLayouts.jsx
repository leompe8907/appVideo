import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { getCurrentEpgEvent } from '../../utils/epgCurrentEvent';
import { parseEpgDateToMs, formatHHmmFromMs } from '../../utils/epgTime';
import { useParental } from '../../store/useParental';
import { getChannelStableId } from '../../utils/channelId';
import { proxyImageUrl } from '../../utils/imageProxy';
import { getTvActionFromKeyEvent, TV_ACTION } from '../../utils/tvRemote';
import {
  getBouquetGridHorizontalClasses,
  getBouquetGridVerticalClasses,
  getBouquetRowCarouselClasses,
} from '../../utils/bouquetLayoutClasses';
import { EmblaHorizontalRail } from '../navigation/EmblaHorizontalRail';

// --- Helpers EPG para layout event_and_logo ---
/** Parsea "YYYY-MM-DD HH:mm:ss" a "HH:mm" para mostrar en UI */
function formatEpgTime(dateStr) {
  const ms = parseEpgDateToMs(dateStr);
  return ms == null ? '' : formatHHmmFromMs(ms);
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
function buildLogoUrlFromLogo2Id(channel, baseUrl) {
  if (!channel) return null;
  const logo2id =
    channel.logo2id ?? channel.logo2Id ?? channel.logo2ID ?? channel.logo_2_id;
  if (!logo2id) return null;

  // Ruta estándar: cdn/public/images/(logo2id)/v/thumb.png
  const path = `/cdn/public/images/${logo2id}/v/thumb.png`;
  const base = typeof baseUrl === 'string' ? baseUrl.replace(/\/$/, '') : '';
  return base ? `${base}${path}` : path;
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
    value === 'service_layout_logo_with_number' ||
    value === 'logo_with_number' ||
    value === 'logo+lcn'
  ) {
    return 'logo_with_number';
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
export function BouquetRowCarousel({ bouquet, onChannelSelect, onChannelFocus, layoutType }) {
  const { t } = useTranslation();
  const title =
    bouquet?.name ??
    bouquet?.title ??
    bouquet?.Name ??
    bouquet?.Title ??
    t('bouquet.unknown');

  const items = Array.isArray(bouquet?.items) ? bouquet.items : [];
  if (items.length === 0) return null;

  const { carousel: carouselClass, track: trackClass } = getBouquetRowCarouselClasses(layoutType);

  return (
    <div
      className={carouselClass}
      data-bouquet-id={bouquet.bouquetId ?? bouquet.id ?? ''}
      data-layout={layoutType ?? ''}
    >
      <h4 className="bouquet-heading">{title}</h4>
      <EmblaHorizontalRail className={trackClass}>
        {items.map((channel, index) => (
          <ChannelCard
            key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
            channel={channel}
            layoutType={layoutType}
            onSelect={() => onChannelSelect?.(channel, bouquet)}
            onFocus={() => onChannelFocus?.(channel, bouquet)}
          />
        ))}
      </EmblaHorizontalRail>
    </div>
  );
}

/**
 * Tarjeta de canal. Su diseño concreto depende de la variante:
 * - logo: solo logo del canal
 * - event: imagen del evento (o logo si no hay)
 * - event_and_logo: logo arriba + imagen de evento abajo + barra de tiempo (timeship)
 * - event_line: igual que event pero con tamaño mayor
 * - logo_with_number: logo centrado en tarjeta + LCN abajo a la derecha + nombre debajo
 */
function ChannelCard({ channel, layoutType, onSelect, onFocus }) {
  const parental = useParental();
  const [focused, setFocused] = useState(false);

  const bgColor = normalizeColor(channel.backgroundColor ?? channel.bgColor);
  const variant = getChannelLayoutVariant(layoutType);
  const style =
    variant === 'event_and_logo' || variant === 'logo_with_number'
      ? {}
      : bgColor
        ? { backgroundColor: bgColor }
        : {};
  const logoWithNumberFrameStyle = bgColor ? { backgroundColor: bgColor } : undefined;
  const channelLcn =
    channel.lcn ?? channel.LCN ?? channel.logicalChannelNumber ?? channel.logical_channel_number;
  const showLcn = channelLcn != null && String(channelLcn).trim() !== '';

  const channelId = getChannelStableId(channel);
  const isBlocked = parental.enabled && channelId ? parental.isChannelBlocked(channelId) : false;

  // EPG: evento actual al aire (para event_and_logo)
  const epgItems = useMemo(() => channel.epgItems ?? [], [channel.epgItems]);
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
  useEffect(() => {
    epgItemsRef.current = epgItems;
  }, [epgItems]);
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
  const brandBaseUrl = currentBrand?.drm || currentBrand?.baseUrl || '';

  // Imagen de evento: EPG primero, luego fallbacks. Cadena: evento → logo → placeholder
  const eventImage = eventImageFromEpg || channel.eventImage || channel.currentEvent?.image || null;
  const fallbackLogoImage = channel.img || null;
  // Preferimos URLs absolutas (drm baseUrl) para evitar 404 en deploy (Vercel) con rutas relativas /cdn/...
  const initialLogoUrl = buildLogoUrlFromLogo2Id(channel, brandBaseUrl) || fallbackLogoImage;
  const [logoImage, setLogoImage] = useState(() => initialLogoUrl);
  const currentEventKey = currentEpgEvent?.event_id ?? `${channel.id ?? ''}-${channel.lcn ?? ''}`;
  const [failedEventKey, setFailedEventKey] = useState(null);
  const eventImageFailed = failedEventKey != null && failedEventKey === currentEventKey;

  // Si el canal se normaliza (p. ej. tvDataService convierte img a URL absoluta) o cambia de brand,
  // re-sincronizar el logo solo si estamos en placeholder/fallback anterior.
  useEffect(() => {
    if (!initialLogoUrl) return;
    setLogoImage((prev) => {
      if (!prev) return initialLogoUrl;
      if (prev === placeholderImageUrl) return initialLogoUrl;
      if (fallbackLogoImage && prev === fallbackLogoImage) return initialLogoUrl;
      // Si el prev era una ruta relativa /cdn/... y ahora tenemos baseUrl, actualizar.
      if (typeof prev === 'string' && prev.startsWith('/cdn/public/images/') && brandBaseUrl) {
        return initialLogoUrl;
      }
      return prev;
    });
  }, [initialLogoUrl, placeholderImageUrl, fallbackLogoImage, brandBaseUrl]);

  const handleLogoError = () => {
    if (fallbackLogoImage && logoImage !== fallbackLogoImage) {
      setLogoImage(fallbackLogoImage);
    } else if (placeholderImageUrl) {
      setLogoImage(placeholderImageUrl);
    }
  };

  const handleEventImageError = () => {
    setFailedEventKey(currentEventKey);
  };

  // Cadena: imagen de evento → logo del canal → placeholder (si evento o logo faltan/fallan)
  const effectiveEventImageRaw =
    eventImage && !eventImageFailed ? eventImage : (logoImage || placeholderImageUrl || '');
  const effectiveEventImage = proxyImageUrl(effectiveEventImageRaw);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (import.meta.env?.DEV) {
      console.log('[ChannelCard] click', channel?.id ?? channel?.lcn);
    }
    onFocus?.();
    onSelect?.();
  };

  const handleKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (getTvActionFromKeyEvent(e) === TV_ACTION.ENTER) {
      e.preventDefault();
      onFocus?.();
      onSelect?.();
    }
  };

  return (
    <div
      className={[
        'channel-card',
        `channel-card--${variant}`,
        focused ? 'focused' : '',
        isBlocked ? 'channel-card--blocked' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      onMouseEnter={() => onFocus?.()}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      data-lcn={channel.lcn}
      data-id={channel.id}
    >
      {isBlocked ? <div className="channel-card-lock" aria-hidden="true">🔒</div> : null}
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
      ) : variant === 'logo_with_number' ? (
        <>
          <div className="channel-card-lwn-frame" style={logoWithNumberFrameStyle}>
            <img
              src={logoImage || placeholderImageUrl}
              alt={channel.name || ''}
              className="channel-card-lwn-logo"
              onError={handleLogoError}
            />
            {showLcn ? (
              <span className="channel-card-lwn-lcn" aria-hidden="true">
                {channelLcn}
              </span>
            ) : null}
          </div>
          {channel.name ? (
            <span className="channel-card-lwn-name" title={channel.name}>
              {channel.name}
            </span>
          ) : null}
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
export function BouquetGridHorizontal({ bouquet, onChannelSelect, onChannelFocus, layoutType }) {
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

  const { root: gridClass, track: trackClass } = getBouquetGridHorizontalClasses(layoutType);

  return (
    <div
      className={gridClass}
      data-bouquet-id={bouquet.bouquetId ?? bouquet.id ?? ''}
      data-layout={layoutType ?? ''}
    >
      <h4 className="bouquet-heading">{title}</h4>
      <div className="bouquet-grid-horizontal-rows">
        {rows.map((row, rowIndex) => (
          <EmblaHorizontalRail key={`row-${rowIndex}`} className={trackClass}>
            {row.map(({ channel, index }) => (
              <ChannelCard
                key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
                channel={channel}
                layoutType={layoutType}
                onSelect={() => onChannelSelect?.(channel, bouquet)}
                onFocus={() => onChannelFocus?.(channel, bouquet)}
              />
            ))}
          </EmblaHorizontalRail>
        ))}
      </div>
    </div>
  );
}

/**
 * Layout de tipo grid vertical: N columnas de canales que se desplazan
 * de arriba hacia abajo.
 */
export function BouquetGridVertical({ bouquet, onChannelSelect, onChannelFocus, layoutType }) {
  const { t } = useTranslation();
  const title =
    bouquet?.name ??
    bouquet?.title ??
    bouquet?.Name ??
    bouquet?.Title ??
    t('bouquet.unknown');

  const items = Array.isArray(bouquet?.items) ? bouquet.items : [];
  if (items.length === 0) return null;

  const { root: gridClass, track: trackClass } = getBouquetGridVerticalClasses(layoutType);

  return (
    <div
      className={gridClass}
      data-bouquet-id={bouquet.bouquetId ?? bouquet.id ?? ''}
      data-layout={layoutType ?? ''}
    >
      <h4 className="bouquet-heading">{title}</h4>
      <div className={trackClass}>
        {items.map((channel, index) => (
          <ChannelCard
            key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
            channel={channel}
            layoutType={layoutType}
            onSelect={() => onChannelSelect?.(channel, bouquet)}
            onFocus={() => onChannelFocus?.(channel, bouquet)}
          />
        ))}
      </div>
    </div>
  );
}

