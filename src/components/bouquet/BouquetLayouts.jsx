import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

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
  const style = bgColor ? { backgroundColor: bgColor } : {};
  const variant = getChannelLayoutVariant(layoutType);

  // Datos de evento (si el backend los provee)
  const eventImage = channel.eventImage || channel.currentEvent?.image || null;
  const fallbackLogoImage = channel.img || null;
  const initialLogoUrl = buildLogoUrlFromLogo2Id(channel) || fallbackLogoImage;
  const [logoImage, setLogoImage] = useState(initialLogoUrl);

  const handleLogoError = () => {
    if (fallbackLogoImage && logoImage !== fallbackLogoImage) {
      setLogoImage(fallbackLogoImage);
    }
  };

  const handleClick = () => {
    if (!isTV) {
      onSelect?.();
    }
  };

  const handleKeyDown = (e) => {
    if (!isTV && (e.key === 'Enter' || e.key === ' ')) {
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
          {logoImage && (
            <div className="channel-card-logo-top">
              <img
                src={logoImage}
                alt={channel.name || ''}
                className="channel-card-logo-img"
                onError={handleLogoError}
              />
            </div>
          )}
          <div className="channel-card-event-block">
            <img
              src={eventImage || logoImage}
              alt={channel.name || ''}
              className="channel-card-event-img"
              // Si no hay imagen de evento, permitimos fallback al logo de canal
              onError={!eventImage ? handleLogoError : undefined}
            />
            <div className="channel-timeship">
              <div className="channel-timeship-progress" />
            </div>
          </div>
        </>
      ) : (
        <>
          <img
            src={
              variant === 'event' || variant === 'event_line'
                ? eventImage || logoImage
                : logoImage
            }
            alt={channel.name || ''}
            className="channel-card-img"
            onError={handleLogoError}
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

