/**
 * Página VOD: categorías y recomendados desde PreloadContext.
 * Por género: 9 ítems + "Ver más" que abre modal con todo el género.
 * Al seleccionar un ítem (película o serie) se abre el modal de detalle; desde ahí se reproduce.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreload } from '../contexts/PreloadContext';
import { useBrand } from '../contexts/BrandContext';
import { usePlayer } from '../contexts/PlayerContext';
import VodCard from '../components/vod/VodCard';
import VodSeeMoreCard from '../components/vod/VodSeeMoreCard';
import VodDetailModal from '../components/vod/VodDetailModal';
import VodCategoryModal from '../components/vod/VodCategoryModal';
import '../styles/pages/_vod.scss';

const ITEMS_PER_ROW = 9;

export function VodPage() {
  const { t } = useTranslation();
  const { vod, loadVOD } = usePreload();
  const { currentBrand, getImage } = useBrand();
  const { play, containerRef, state: playerState } = usePlayer();
  const [detailItem, setDetailItem] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);

  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');
  const baseUrl = currentBrand?.drm || '';
  const { status, categories, vodRecommended, error } = vod;

  const handleVodSelect = (item) => {
    if (!item?.id) return;
    setCategoryModal(null);
    setDetailItem(item);
  };

  const openCategoryModal = (name, vods) => {
    setCategoryModal({ name, vods: vods || [] });
  };

  const handlePlayFromModal = (params) => {
    if (params?.url) play(params);
  };

  if (status === 'idle' && currentBrand) {
    loadVOD(currentBrand, { t });
  }

  return (
    <div
      className="vod-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="vod-overlay" />
      <div
        className={`vod-player-video${playerState?.url ? ' vod-player-video--active' : ''}`}
        ref={containerRef}
      />
      <div className="vod-container">
        <header className="vod-header">
          <h1 className="vod-title">{t('vod.title')}</h1>
        </header>

        {status === 'loading' && (
          <div className="vod-loading">
            <div className="vod-loading-spinner" />
            <p>{t('vod.loading')}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="vod-error">
            <p>{error || t('vod.errorLoad')}</p>
          </div>
        )}

        {status === 'ready' && (
          <div className="vod-content">
            {vodRecommended?.length > 0 && (
              <section className="vod-row" aria-label={t('vod.recommended')}>
                <h2 className="vod-row-title">{t('vod.recommended')}</h2>
                <div className="vod-row-cards">
                  {vodRecommended.slice(0, ITEMS_PER_ROW).map((v, i) => (
                    <VodCard
                      key={v.id ?? i}
                      item={v}
                      index={i}
                      onSelect={handleVodSelect}
                      focusKeyPrefix="vod-rec"
                      baseUrl={baseUrl}
                    />
                  ))}
                  {vodRecommended.length > ITEMS_PER_ROW && (
                    <VodSeeMoreCard
                      focusKeyPrefix="vod-rec"
                      onSelect={() => openCategoryModal(t('vod.recommended'), vodRecommended)}
                    />
                  )}
                </div>
              </section>
            )}
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
            {status === 'ready' && (!categories?.length || categories.every((c) => !(c.vods?.length))) && !vodRecommended?.length && (
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

      {detailItem && (
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
