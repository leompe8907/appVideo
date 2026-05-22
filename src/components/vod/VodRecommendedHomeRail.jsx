/**
 * Carril VOD "Recomendados" solo en Inicio (debajo del muro de bouquets).
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBrand } from '../../contexts/BrandContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { usePreload } from '../../store/usePreload';
import { useParentalGate } from '../../hooks/useParentalGate';
import VodCard from './VodCard';
import VodSeeMoreCard from './VodSeeMoreCard';
import VodDetailModal from './VodDetailModal';
import VodDetailModalClassic from './VodDetailModalClassic';
import { HorizontalScrollRail } from '../navigation/HorizontalScrollRail';
import '../../styles/pages/_vod.scss';

const ITEMS_PER_ROW = 9;

export function VodRecommendedHomeRail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBrand } = useBrand();
  const { play } = usePlayer();
  const { requestPlayMedia } = useParentalGate();
  const { vod, loadVOD } = usePreload();
  const [detailItem, setDetailItem] = useState(null);
  const vodRetryRef = useRef(false);

  const baseUrl = currentBrand?.drm || '';
  const vodLayout = currentBrand?.vod?.layout === 'classic' ? 'classic' : 'hero';
  const status = vod.status;
  const categories = vod.categories || [];
  const vodRecommended = vod.vodRecommended || [];

  useEffect(() => {
    if (!currentBrand) return;
    if (status === 'idle') {
      loadVOD(currentBrand, { t });
      return;
    }
    if (status === 'error' && !vodRetryRef.current) {
      vodRetryRef.current = true;
      loadVOD(currentBrand, { t, force: true, enableRetry: true });
    }
  }, [status, currentBrand, loadVOD, t]);

  // Si el usuario navega (incluyendo "Home" sobre /home/inicio), cerrar el modal de detalle.
  useEffect(() => {
    setDetailItem(null);
  }, [location.key]);

  const handleVodSelect = (item) => {
    if (!item?.id) return;
    setDetailItem(item);
  };

  const handlePlayFromModal = (params) => {
    if (!params?.url) return;
    requestPlayMedia({
      item: params.item,
      ratingRaw: params?.item?.parentalRating,
      title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
      message: t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
      playFn: () => play(params),
    });
  };

  const showRail = status === 'ready' && vodRecommended.length > 0;

  return (
    <>
      {showRail && (
        <section
          className="vod-row bouquet-vod-recommended"
          aria-label={t('vod.recommended')}
        >
          <h2 className="vod-row-title">{t('vod.recommended')}</h2>
          <HorizontalScrollRail className="vod-row-cards">
            {vodRecommended.length > ITEMS_PER_ROW && (
              <VodSeeMoreCard
                label={t('vod.seeAllMovies')}
                textInPoster
                onSelect={() => navigate('/home/vod')}
              />
            )}
            {vodRecommended.map((v, i) => (
              <VodCard
                key={v.id ?? i}
                item={v}
                onSelect={handleVodSelect}
                baseUrl={baseUrl}
              />
            ))}
          </HorizontalScrollRail>
        </section>
      )}

      {detailItem && vodLayout === 'classic' && (
        <VodDetailModalClassic
          item={detailItem}
          categories={categories}
          onClose={() => setDetailItem(null)}
          onPlay={handlePlayFromModal}
        />
      )}
      {detailItem && vodLayout === 'hero' && (
        <VodDetailModal
          item={detailItem}
          categories={categories}
          onClose={() => setDetailItem(null)}
          onPlay={handlePlayFromModal}
        />
      )}
    </>
  );
}

export default VodRecommendedHomeRail;
