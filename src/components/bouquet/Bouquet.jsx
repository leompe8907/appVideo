/**
 * Componente Bouquet: obtiene y muestra la lista de bouquets disponibles.
 * Se activa después de seleccionar un perfil o una tarjeta (licencia).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import { usePreload } from '../../store/usePreload';
import { mergeEpgIntoChannels } from '../../utils/epgMerge';
import { getMainBouquets, getChannelsForBouquet, filterMainBouquets } from '../../services/tvDataService';

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

  /** Bouquets principales con canales y EPG fusionados desde PreloadContext (sin nuevas llamadas a getBouquets/getAvailableStreams). */
  const bouquetsFromPreload = useMemo(() => {
    if (epg.status !== 'ready') return null;
    return filterMainBouquets(epg.bouquetsWithChannels || []).map((b) => ({
      ...b,
      items: mergeEpgIntoChannels(b.items || [], epg.streams),
    }));
  }, [epg.status, epg.bouquetsWithChannels, epg.streams]);

  const [fallbackBouquets, setFallbackBouquets] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState(null);

  const [selectedBouquet, setSelectedBouquet] = useState(null);
  const [channels, setChannels] = useState([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState(null);

  const fetchBouquetsFallback = useCallback(async () => {
    try {
      setFallbackLoading(true);
      setFallbackError(null);
      const mainBouquets = await getMainBouquets({ enableRetry: false });
      setFallbackBouquets(mainBouquets);
    } catch (err) {
      console.error('[Bouquet] Error al obtener bouquets:', err);
      setFallbackBouquets([]);
      setFallbackError(err?.errorInfo?.userMessage || err?.message || t('bouquet.errorLoad'));
    } finally {
      setFallbackLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (epg.status === 'error') {
      fetchBouquetsFallback();
    }
  }, [epg.status, fetchBouquetsFallback]);

  const bouquets = bouquetsFromPreload !== null ? bouquetsFromPreload : fallbackBouquets;
  const isLoading = bouquetsFromPreload !== null ? false : fallbackLoading;
  const error = bouquetsFromPreload !== null ? null : fallbackError;

  useEffect(() => {
    if (isTV && bouquets.length > 0) {
      const timer = setTimeout(() => {
        const setFocus = SpatialNavigation.setFocus || SpatialNavigation.focus || SpatialNavigation.default?.setFocus;
        if (setFocus && typeof setFocus === 'function') {
          setFocus('bouquet-0');
        } else {
          const el = document.querySelector('[data-focus-key="bouquet-0"]');
          if (el) el.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, bouquets.length]);

  const handleSelectBouquet = async (bouquet) => {
    setSelectedBouquet(bouquet);
    setChannelsError(null);
    setChannels([]);

    const fromPreload =
      bouquetsFromPreload !== null &&
      Array.isArray(bouquet.items) &&
      bouquet.items.length > 0;

    if (fromPreload) {
      const merged = mergeEpgIntoChannels(bouquet.items, epg.streams);
      setChannels(merged);
      setIsLoadingChannels(false);
      if (import.meta.env.DEV) {
        const bouquetId = String(bouquet.bouquetId ?? bouquet.id ?? '');
        console.log('[Bouquet] Streams desde preload para bouquet', bouquetId, merged.length);
      }
      return;
    }

    setIsLoadingChannels(true);
    try {
      const filtered = await getChannelsForBouquet(bouquet, { enableRetry: false });
      if (import.meta.env.DEV) {
        const bouquetId = String(bouquet.bouquetId ?? bouquet.id ?? '');
        console.log('[Bouquet] Streams para bouquet', bouquetId, filtered);
      }
      setChannels(filtered);
    } catch (err) {
      console.error('[Bouquet] Error al obtener streams:', err);
      setChannelsError(err?.errorInfo?.userMessage || err?.message || t('bouquet.errorStreams'));
    } finally {
      setIsLoadingChannels(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bouquet-loading">
        <div className="loading-spinner" />
        <p className="bouquet-loading-text">{t('bouquet.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bouquet-error">
        <p className="bouquet-error-text">{error}</p>
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
          {isLoadingChannels && (
            <p className="bouquet-loading-text">{t('bouquet.loadingStreams')}</p>
          )}
          {channelsError && (
            <p className="bouquet-error-text">{channelsError}</p>
          )}
          {!isLoadingChannels && !channelsError && (
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

  const { ref, focused } = useSpatialNavigation({
    focusKey: `bouquet-${index}`,
    isFocusable: true,
    onEnterPress: () => onSelect?.(bouquet),
  });

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
      ref={ref}
      className={`bouquet-row ${focused ? 'focused' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isTV ? -1 : 0}
      aria-label={t('bouquet.bouquetAria', { name })}
      data-focus-key={`bouquet-${index}`}
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
