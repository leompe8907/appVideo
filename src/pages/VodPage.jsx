/**
 * Página VOD: categorías desde PreloadContext (recomendados solo en Inicio).
 * Por género: 9 ítems + "Ver más" que abre modal con todo el género.
 * Al seleccionar un ítem (película o serie) se abre el modal de detalle; desde ahí se reproduce.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePlayer } from '../contexts/PlayerContext';
import { usePreload } from '../store/usePreload';
import { useParentalGate } from '../hooks/useParentalGate';
import VodCard from '../components/vod/VodCard';
import VodSeeMoreCard from '../components/vod/VodSeeMoreCard';
import VodDetailModal from '../components/vod/VodDetailModal';
import VodDetailModalClassic from '../components/vod/VodDetailModalClassic';
import VodCategoryModal from '../components/vod/VodCategoryModal';
import '../styles/pages/_vod.scss';

const ITEMS_PER_ROW = 9;

export function VodPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentBrand } = useBrand();
  const { play } = usePlayer();
  const { requestPlayMedia } = useParentalGate();
  const { vod, loadVOD } = usePreload();
  const [detailItem, setDetailItem] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const vodRetryOnEnterRef = useRef(false);

  const baseUrl = currentBrand?.drm || '';
  const vodLayout = currentBrand?.vod?.layout === 'classic' ? 'classic' : 'hero';
  const status = vod.status;
  const categories = vod.categories || [];
  const allVods = useMemo(() => vod.allVods || [], [vod.allVods]);
  const error = vod.error || '';

  useEffect(() => {
    if (!currentBrand) return;
    if (status === 'idle') {
      loadVOD(currentBrand, { t });
      return;
    }
    if (status === 'error' && !vodRetryOnEnterRef.current) {
      vodRetryOnEnterRef.current = true;
      loadVOD(currentBrand, { t, force: true, enableRetry: true });
    }
  }, [status, currentBrand, loadVOD, t]);

  /** Abrir detalle VOD desde publicidad (genericData vod_id=) */
  useEffect(() => {
    const id = location.state?.adOpenVodId;
    if (id == null) return;
    if (status !== 'ready' || !Array.isArray(allVods)) return;
    const item = allVods.find((v) => String(v.id) === String(id));
    const timer = setTimeout(() => {
      if (item) setDetailItem(item);
      navigate('/home/vod', { replace: true, state: {} });
    }, 0);
    return () => clearTimeout(timer);
  }, [location.state, allVods, status, navigate]);

  const handleVodSelect = (item) => {
    if (!item?.id) return;
    setCategoryModal(null);
    setDetailItem(item);
  };

  const openCategoryModal = (name, vods) => {
    setCategoryModal({ name, vods: vods || [] });
  };

  const handlePlayFromModal = (params) => {
    if (!params?.url) return;
    // Gate por rating (VOD): antes de reproducir.
    requestPlayMedia({
      item: params.item,
      ratingRaw: params?.item?.parentalRating,
      title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
      message: t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
      playFn: () => play(params),
    });
  };

  return (
    <div className="vod-page">
      <div className="vod-overlay" />
      <div className="vod-container">
        <header className="vod-header">
          <h1 className="vod-title">{t('vod.title')}</h1>
        </header>

        {status === 'loading' && (
          <div className="vod-loading">
            <div style={{ width: '60%', maxWidth: 520, marginBottom: 14 }}>
              <div className="skeleton skeleton--text" />
            </div>
            <div style={{ width: '90%', maxWidth: 920, height: 180 }}>
              <div className="skeleton skeleton--card" style={{ height: '100%' }} />
            </div>
            <p style={{ marginTop: 12 }}>{t('vod.loading')}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="vod-error">
            <p>{error || t('vod.errorLoad')}</p>
            <button
              type="button"
              className="vod-error-refresh-button"
              onClick={() => window.location.reload()}
            >
              {t('common.refreshPage', { defaultValue: 'Refrescar página' })}
            </button>
          </div>
        )}

        {status === 'ready' && (
          <div className="vod-content">
            {categories?.map((cat, catIndex) => {
              const catVods = cat.vods || [];
              return (
                <section
                  key={cat.id ?? cat.name}
                  className="vod-row"
                  aria-label={cat.name}
                >
                  <h2 className="vod-row-title">{cat.name}</h2>
                  <div className="vod-row-cards">
                    {catVods.slice(0, ITEMS_PER_ROW).map((v, i) => (
                      <VodCard
                        key={v.id ?? i}
                        item={v}
                        index={i}
                        onSelect={handleVodSelect}
                        focusKeyPrefix={`vod-cat-${cat.id ?? catIndex}`}
                        baseUrl={baseUrl}
                      />
                    ))}
                    {catVods.length > ITEMS_PER_ROW && (
                      <VodSeeMoreCard
                        focusKeyPrefix={`vod-cat-${cat.id ?? catIndex}`}
                        onSelect={() => openCategoryModal(cat.name, catVods)}
                      />
                    )}
                  </div>
                </section>
              );
            })}
            {status === 'ready' &&
              (!categories?.length || categories.every((c) => !(c.vods?.length))) && (
                <p className="vod-no-content">{t('vod.noContent')}</p>
              )}
          </div>
        )}
      </div>

      {categoryModal && (
        <VodCategoryModal
          categoryName={categoryModal.name}
          vods={categoryModal.vods}
          onSelectItem={handleVodSelect}
          onClose={() => setCategoryModal(null)}
        />
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
    </div>
  );
}

export default VodPage;
