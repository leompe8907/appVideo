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
 * Diseño tipo 10foot: fila horizontal de canales por bouquet.
 * Espera un objeto bouquet con:
 * - bouquet.bouquetId
 * - bouquet.name / description
 * - bouquet.items: array de canales { id, name, img, lcn, backgroundColor, ... }
 */
export function BouquetRowCarousel({ bouquet, onChannelSelect, layoutType = 'channels' }) {
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
            onSelect={() => onChannelSelect?.(channel, bouquet)}
          />
        ))}
      </div>
    </div>
  );
}

function ChannelCard({ channel, index, onSelect }) {
  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    focusKey: `channel-${channel.id ?? index}`,
    isFocusable: true,
  });

  const bgColor = normalizeColor(channel.backgroundColor ?? channel.bgColor);
  const style = bgColor ? { backgroundColor: bgColor } : {};

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
      className={`channel-card ${focused ? 'focused' : ''}`}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isTV ? -1 : 0}
      role="button"
      data-lcn={channel.lcn}
      data-id={channel.id}
    >
      {channel.img && (
        <img
          src={channel.img}
          alt={channel.name || ''}
          className="channel-card-img"
        />
      )}
    </div>
  );
}

