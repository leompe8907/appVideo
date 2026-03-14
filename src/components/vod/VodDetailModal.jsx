/**
 * Modal de detalle VOD: película (reproducir) o serie (lista de episodios y reproducir).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import panaccessService from '../../services/panaccessService';
import { getVodImageUrl } from '../../services/vodService';
import { useBrand } from '../../contexts/BrandContext';

export function VodDetailModal({ item, onClose, onPlay }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const baseUrl = currentBrand?.drm || '';
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [loading, setLoading] = useState(!!item?.isSeries);
  const [error, setError] = useState(null);

  const isSeries = item?.isSeries === true;
  const title = item?.name || item?.title || '';
  const description = item?.description || seriesInfo?.description || '';
  const posterUrl =
    item?.posterInfoURL ||
    item?.posterListURL ||
    (item?.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image1Id, 'posterInfo') : null);

  useEffect(() => {
    if (!isSeries || !item?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    panaccessService
      .getVodSeriesInfo({ seriesId: item.id, enableRetry: false })
      .then((data) => {
        if (!cancelled) {
          const episodes = data?.episodes ?? data?.seasons?.flatMap((s) => s.episodes ?? []) ?? [];
          setSeriesInfo({ ...data, episodes: Array.isArray(episodes) ? episodes : [] });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || t('vod.errorLoadSeries'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [item?.id, isSeries, t]);

  const handlePlay = (vodItem) => {
    const vodId = vodItem?.id ?? vodItem?.vodId;
    if (vodId == null) return;
    try {
      const url = panaccessService.getVodM3u8Url({ vodId });
      onPlay?.({ type: 'vod', id: vodId, url, item: vodItem, autoPlay: true });
      onClose?.();
    } catch (e) {
      setError(e?.message || t('vod.errorPlay'));
    }
  };

  const handlePlayCurrent = () => {
    if (isSeries && seriesInfo?.episodes?.length > 0) {
      handlePlay(seriesInfo.episodes[0]);
    } else if (!isSeries) {
      handlePlay(item);
    }
  };

  return (
    <div className="vod-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="vod-detail-title">
      <div className="vod-detail-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="vod-detail-modal">
        <button
          type="button"
          className="vod-detail-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
        <div className="vod-detail-content">
          <div className="vod-detail-poster">
            {posterUrl ? (
              <img src={posterUrl} alt="" />
            ) : (
              <div className="vod-detail-poster-placeholder" />
            )}
          </div>
          <div className="vod-detail-info">
            <h2 id="vod-detail-title" className="vod-detail-title">{title}</h2>
            {description && <p className="vod-detail-description">{description}</p>}
            {error && <p className="vod-detail-error">{error}</p>}
            {loading && <p className="vod-detail-loading">{t('vod.loading')}</p>}
            {!isSeries && (
              <button
                type="button"
                className="vod-detail-play-btn"
                onClick={handlePlayCurrent}
              >
                {t('vod.play')}
              </button>
            )}
            {isSeries && !loading && seriesInfo?.episodes?.length > 0 && (
              <div className="vod-detail-episodes">
                <h3>{t('vod.episodes')}</h3>
                <ul className="vod-detail-episodes-list">
                  {seriesInfo.episodes.map((ep, i) => (
                    <EpisodeItem
                      key={ep.id ?? ep.vodId ?? i}
                      episode={ep}
                      index={i}
                      onPlay={() => handlePlay(ep)}
                    />
                  ))}
                </ul>
              </div>
            )}
            {isSeries && !loading && seriesInfo && (!seriesInfo.episodes || seriesInfo.episodes.length === 0) && (
              <button
                type="button"
                className="vod-detail-play-btn"
                onClick={handlePlayCurrent}
              >
                {t('vod.play')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EpisodeItem({ episode, index, onPlay }) {
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: onPlay,
    focusKey: `vod-episode-${index}`,
    isFocusable: true,
  });
  const name = episode.name ?? episode.title ?? episode.episodeTitle ?? `Episode ${index + 1}`;
  return (
    <li>
      <button
        ref={ref}
        type="button"
        className={`vod-episode-btn ${focused ? 'focused' : ''}`}
        onClick={onPlay}
        tabIndex={-1}
      >
        {name}
      </button>
    </li>
  );
}

export default VodDetailModal;
