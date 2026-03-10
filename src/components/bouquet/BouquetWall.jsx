import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBouquetsWithChannels } from '../../services/tvDataService';
import { BouquetRowCarousel } from './BouquetLayouts';

/**
 * BouquetWall: muestra filas horizontales de canales agrupados por bouquet,
 * similar a la home de 10foot.
 */
export function BouquetWall({ onChannelSelect }) {
  const { t } = useTranslation();
  const [bouquets, setBouquets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const list = await getBouquetsWithChannels({ enableRetry: false });
        if (!isMounted) return;
        setBouquets(list);
      } catch (err) {
        if (!isMounted) return;
        console.error('[BouquetWall] Error al cargar bouquets con canales:', err);
        setError(err?.errorInfo?.userMessage || err?.message || t('bouquet.errorLoad'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [t]);

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
      {bouquets.map((bouquet) => (
        <BouquetRowCarousel
          key={bouquet.bouquetId ?? bouquet.id}
          bouquet={bouquet}
          onChannelSelect={onChannelSelect}
        />
      ))}
    </div>
  );
}

export default BouquetWall;

