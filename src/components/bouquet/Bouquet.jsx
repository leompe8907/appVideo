/**
 * Componente Bouquet: obtiene y muestra la lista de bouquets disponibles.
 * Se activa después de seleccionar un perfil o una tarjeta (licencia).
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { usePreload } from '../../store/usePreload';
import { filterMainBouquets } from '../../services/tvDataService';

/**
 * Normaliza un color devuelto por el backend (ej. "ffffff  ") a formato CSS (#ffffff).
 * Devuelve null si no es válido.
 */
function normalizeColor(color) {
  if (!color || typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  // Si ya viene con "#", devolver tal cual
  if (trimmed.startsWith('#')) return trimmed;
  // Asegurar longitud 3 o 6
  if (trimmed.length === 3 || trimmed.length === 6) {
    return `#${trimmed}`;
  }
  return null;
}

export function Bouquet() {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const { epg } = usePreload();

  /** Bouquets principales con canales y EPG fusionados desde PreloadContext (sin nuevas llamadas a red). */
  const bouquets = useMemo(() => {
    if (epg.status !== 'ready') return [];
    return filterMainBouquets(epg.bouquetsWithChannels || []);
  }, [epg.status, epg.bouquetsWithChannels]);

  const [selectedBouquet, setSelectedBouquet] = useState(null);
  const [channels, setChannels] = useState([]);
  const [channelsError, setChannelsError] = useState(null);

  useEffect(() => {
    if (isTV && bouquets.length > 0) {
      const timer = setTimeout(() => {
        const el = document.getElementById('bouquet-0');
        if (el) el.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, bouquets.length]);

  const handleSelectBouquet = (bouquet) => {
    setSelectedBouquet(bouquet);
    setChannelsError(null);
    setChannels([]);

    if (!Array.isArray(bouquet.items) || bouquet.items.length === 0) {
      setChannelsError(t('bouquet.errorStreams'));
      return;
    }

    setChannels(bouquet.items);
    if (import.meta.env.DEV) {
      const bouquetId = String(bouquet.bouquetId ?? bouquet.id ?? '');
      console.log('[Bouquet] Streams desde preload para bouquet', bouquetId, bouquet.items.length);
    }
  };

  if (epg.status === 'error') {
    return (
      <div className="bouquet-error">
        <p className="bouquet-error-text">{epg.error || t('bouquet.errorLoad')}</p>
      </div>
    );
  }

  if (bouquets.length === 0) {
    return (
      <div className="bouquet-empty">
        <p className="bouquet-empty-text">{t('bouquet.noBouquets')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bouquet-list">
        {bouquets.map((bouquet, index) => (
          <BouquetRow
            key={bouquet.bouquetId ?? bouquet.id ?? index}
            bouquet={bouquet}
            index={index}
            onSelect={handleSelectBouquet}
          />
        ))}
      </div>
      {selectedBouquet && (
        <div className="bouquet-streams-info">
          {channelsError && (
            <p className="bouquet-error-text">{channelsError}</p>
          )}
          {!channelsError && (
            <p className="bouquet-streams-count">
              {t('bouquet.streamsCount', { count: channels.length })}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function BouquetRow({ bouquet, index, onSelect }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const name = bouquet.name ?? bouquet.title ?? bouquet.Name ?? bouquet.Title ?? `Bouquet ${index + 1}`;

  const backgroundColor = normalizeColor(bouquet.backgroundColor ?? bouquet.bgColor);
  const textColor = normalizeColor(bouquet.textColor ?? bouquet.fgColor);

  const style = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { color: textColor } : {}),
  };

  const handleClick = () => {
    onSelect?.(bouquet);
  };

  const handleKeyDown = (e) => {
    if (!isTV && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect?.(bouquet);
    }
  };

  return (
    <div
      id={`bouquet-${index}`}
      className="bouquet-row"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isTV ? -1 : 0}
      aria-label={t('bouquet.bouquetAria', { name })}
      style={style}
    >
      <div className="bouquet-row-content">
        <div className="bouquet-row-main">
          <span className="bouquet-row-name">{name}</span>
        </div>
      </div>
    </div>
  );
}

export default Bouquet;
