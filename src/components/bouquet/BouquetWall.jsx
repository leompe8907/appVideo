import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getBouquetsWithChannels,
  filterBouquetsForInicio,
  filterBouquetsForTvRadioServices,
} from '../../services/tvDataService';
import { usePreload } from '../../store/usePreload';
import { mergeEpgIntoChannels } from '../../utils/epgMerge';
import {
  BouquetRowCarousel,
  BouquetGridHorizontal,
  BouquetGridVertical,
} from './BouquetLayouts';

/**
 * BouquetWall: filas de canales por bouquet (home 10foot).
 * Con precarga EPG lista: usa `epg.bouquetsWithChannels` del PreloadContext (sin repetir getBouquets/getAvailableStreams).
 * Solo pide red si el preload de EPG falló.
 *
 * @param {'inicio' | 'servicios'} variant - inicio: isMain !== false explícito; servicios: solo isMain=false.
 */
export function BouquetWall({ onChannelSelect, variant = 'inicio' }) {
  const { t } = useTranslation();
  const { epg } = usePreload();

  const bouquetsFromPreload = useMemo(() => {
    if (epg.status !== 'ready') return null;
    const list = epg.bouquetsWithChannels || [];
    const merged = list.map((b) => ({
      ...b,
      items: mergeEpgIntoChannels(b.items || [], epg.streams),
    }));
    return variant === 'servicios'
      ? filterBouquetsForTvRadioServices(merged)
      : filterBouquetsForInicio(merged);
  }, [epg.status, epg.bouquetsWithChannels, epg.streams, variant]);

  const [fallbackBouquets, setFallbackBouquets] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState(null);

  useEffect(() => {
    if (bouquetsFromPreload !== null) {
      return;
    }
    if (epg.status !== 'error') {
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        setFallbackLoading(true);
        setFallbackError(null);
        const list = await getBouquetsWithChannels({ enableRetry: false });
        if (!isMounted) return;
        const withEpg = list.map((b) => ({
          ...b,
          items: mergeEpgIntoChannels(b.items || [], epg.streams),
        }));
        setFallbackBouquets(
          variant === 'servicios' ? filterBouquetsForTvRadioServices(withEpg) : filterBouquetsForInicio(withEpg)
        );
      } catch (err) {
        if (!isMounted) return;
        console.error('[BouquetWall] Error al cargar bouquets con canales:', err);
        setFallbackError(err?.errorInfo?.userMessage || err?.message || t('bouquet.errorLoad'));
      } finally {
        if (isMounted) {
          setFallbackLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [bouquetsFromPreload, epg.status, epg.streams, t, variant]);

  const bouquets = bouquetsFromPreload !== null ? bouquetsFromPreload : fallbackBouquets;
  const isLoading = bouquetsFromPreload !== null ? false : fallbackLoading;
  const error = bouquetsFromPreload !== null ? null : fallbackError;

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

  if (!bouquets || bouquets.length === 0) {
    return (
      <div className="bouquet-empty">
        <p className="bouquet-empty-text">{t('bouquet.noBouquets')}</p>
      </div>
    );
  }

  return (
    <div className="bouquet-wall">
      {bouquets.map((bouquet) => {
        const layoutType = bouquet.layoutType;
        const key = bouquet.bouquetId ?? bouquet.id;

        if (layoutType === 'service_layout_grid_horizontal') {
          return (
            <BouquetGridHorizontal
              key={key}
              bouquet={bouquet}
              layoutType={layoutType}
              onChannelSelect={onChannelSelect}
            />
          );
        }

        if (layoutType === 'service_layout_grid_vertical') {
          return (
            <BouquetGridVertical
              key={key}
              bouquet={bouquet}
              layoutType={layoutType}
              onChannelSelect={onChannelSelect}
            />
          );
        }

        return (
          <BouquetRowCarousel
            key={key}
            bouquet={bouquet}
            layoutType={layoutType}
            onChannelSelect={onChannelSelect}
          />
        );
      })}
    </div>
  );
}

export default BouquetWall;
