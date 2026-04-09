/**
 * Modal de detalle VOD: estilo Hero + capas (Netflix/Disney+).
 * Película: reproducir. Serie: lista de episodios y reproducir.
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevice } from '../../contexts/DeviceContext';
import panaccessService from '../../services/panaccessService';
import { getVodImageUrl } from '../../services/vodService';
import { useBrand } from '../../contexts/BrandContext';
import { FocusableButton } from '../navigation/FocusableButton';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

const DESCRIPTION_MAX_LENGTH = 180;

export function VodDetailModal({ item, categories = [], onClose, onPlay }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { isTV } = useDevice();
  const baseUrl = currentBrand?.drm || '';
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [loading, setLoading] = useState(!!item?.isSeries);
  const [error, setError] = useState(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [extraMeta, setExtraMeta] = useState(null);

  const { setFocus } = useSpatialNavigation();

  useEffect(() => {
    if (isTV && !loading) {
      const t = setTimeout(() => {
        if (typeof setFocus === 'function') setFocus('vod-detail-play');
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isTV, loading, setFocus]);

  const vodDetailConfig = currentBrand?.vod?.vodDetail || {};
  const contentPosition = vodDetailConfig.contentPosition === 'top' || vodDetailConfig.contentPosition === 'middle'
    ? vodDetailConfig.contentPosition
    : 'bottom';

  const isSeries = item?.isSeries === true;
  const title = item?.name || item?.title || '';
  const rawDescription = item?.description || seriesInfo?.description || '';
  const description = rawDescription.trim();
  const hasLongDescription = description.length > DESCRIPTION_MAX_LENGTH;
  const descriptionShort = hasLongDescription ? description.slice(0, DESCRIPTION_MAX_LENGTH).trim() + '…' : description;
  const descriptionToShow = descriptionExpanded || !hasLongDescription ? description : descriptionShort;

  const posterUrl =
    item?.posterInfoURL ||
    item?.posterListURL ||
    (item?.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image1Id, 'posterInfo') : null);

  const heroImageUrl = item?.backgroundImageURL || null;

  const duration = item?.duration != null && item.duration > 0 ? Math.floor(item.duration / 60) : null;
  const durationString = duration != null && duration > 0 ? `${duration} ${t('vod.minutes')}` : '';
  const rating = item?.rating != null ? Number(item.rating) / 10 : null;

  const releaseYear = (() => {
    const raw = item?.libraryReleaseDate;
    if (!raw || typeof raw !== 'string') return null;
    const match = raw.trim().match(/^(\d{4})/);
    return match ? match[1] : null;
  })();

  const parentalRating = item?.parentalRating != null && String(item.parentalRating).trim() !== ''
    ? String(item.parentalRating).trim()
    : null;

  const categoryNames = (() => {
    if (item?.categoryName) return [item.categoryName];
    if (Array.isArray(item?.categoryNames) && item.categoryNames.length > 0) return item.categoryNames;
    const ids = Array.isArray(item?.categories) ? item.categories : [];
    if (ids.length === 0) return [];
    const names = ids
      .map((id) => {
        const cat = categories.find((c) => c.id === id || c.id === Number(id) || String(c.id) === String(id));
        return cat?.name;
      })
      .filter(Boolean);
    return [...new Set(names)];
  })();

  const { castList, directorsList } = useMemo(() => {
    const src = extraMeta || item || {};
    const readList = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
      if (typeof v === 'string') {
        return v
          .split(/[,\|;]/g)
          .map((x) => String(x).trim())
          .filter(Boolean);
      }
      return [];
    };

    const cast = [
      ...readList(src.cast),
      ...readList(src.actors),
      ...readList(src.actor),
      ...readList(src.elenco),
      ...readList(src.actorNames),
    ];
    const directors = [
      ...readList(src.directors),
      ...readList(src.director),
      ...readList(src.diretor),
      ...readList(src.direction),
      ...readList(src.directorNames),
    ];

    return {
      castList: [...new Set(cast)].filter(Boolean),
      directorsList: [...new Set(directors)].filter(Boolean),
    };
  }, [extraMeta, item]);

  useEffect(() => {
    const url = item?.customDataUrl ?? item?.custom_data_url ?? null;
    if (!url || typeof url !== 'string') {
      setExtraMeta(null);
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setExtraMeta(data && typeof data === 'object' ? data : null);
      })
      .catch(() => {
        if (!cancelled) setExtraMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.customDataUrl, item?.custom_data_url]);

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
      <div className="vod-detail-modal vod-detail-hero-layout">
        {/* Hero background */}
        <div
          className="vod-detail-hero"
          style={heroImageUrl ? { backgroundImage: `url(${heroImageUrl})` } : undefined}
        >
          <div className="vod-detail-hero-gradient" />
        </div>

        {/* Close button (PC only) */}
        {!isTV && (
          <button
            type="button"
            className="vod-detail-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            {t('common.close')}
          </button>
        )}

        {/* Content layer */}
        <div className={`vod-detail-content vod-detail-content--${contentPosition}`}>
          <div className="vod-detail-content-inner">
            <div className="vod-detail-poster-wrap">
              {posterUrl ? (
                <img src={posterUrl} alt="" className="vod-detail-poster-img" />
              ) : (
                <div className="vod-detail-poster-placeholder" />
              )}
            </div>
            <div className="vod-detail-info">
              <h2 id="vod-detail-title" className="vod-detail-title">{title}</h2>
              <div className="vod-detail-meta">
                {releaseYear && (
                  <span className="vod-detail-meta-item">{releaseYear}</span>
                )}
                {durationString && <span className="vod-detail-meta-item">{durationString}</span>}
                {parentalRating && (
                  <span className="vod-detail-meta-item vod-detail-parental">{parentalRating.startsWith('+') ? parentalRating : `+${parentalRating}`}</span>
                )}
                {categoryNames.length > 0 && (
                  <span className="vod-detail-meta-categories">
                    {categoryNames.map((name) => (
                      <span key={name} className="vod-detail-meta-item vod-detail-category-tag">{name}</span>
                    ))}
                  </span>
                )}
                {rating != null && rating > 0 && (
                  <span className="vod-detail-meta-item vod-detail-rating">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`vod-detail-star ${i <= Math.floor(rating) ? 'fill' : rating > i - 1 && rating < i ? 'half' : ''}`}
                        aria-hidden
                      />
                    ))}
                  </span>
                )}
              </div>

              {directorsList.length > 0 ? (
                <div className="vod-detail-meta" style={{ marginTop: 10 }}>
                  <span className="vod-detail-meta-item vod-detail-category-tag">
                    {t('vod.directors', { defaultValue: 'Dirección' })}: {directorsList.join(', ')}
                  </span>
                </div>
              ) : null}

              {castList.length > 0 ? (
                <div className="vod-detail-meta" style={{ marginTop: 6 }}>
                  <span className="vod-detail-meta-item vod-detail-category-tag">
                    {t('vod.cast', { defaultValue: 'Reparto' })}: {castList.join(', ')}
                  </span>
                </div>
              ) : null}

              {description && (
                <div className="vod-detail-description-wrap">
                  <p className="vod-detail-description">{descriptionToShow}</p>
                  {hasLongDescription && (
                    <FocusableButton
                      type="button"
                      className="vod-detail-read-more"
                      onClick={() => setDescriptionExpanded((v) => !v)}
                      focusKey="vod-detail-read-more"
                    >
                      {descriptionExpanded ? t('vod.readLess') : t('vod.readMore')}
                    </FocusableButton>
                  )}
                </div>
              )}
              {error && <p className="vod-detail-error">{error}</p>}
              {loading && <p className="vod-detail-loading">{t('vod.loading')}</p>}
              <div className="vod-detail-actions">
                <FocusableButton
                  type="button"
                  className="vod-detail-play-btn"
                  onClick={handlePlayCurrent}
                  focusKey="vod-detail-play"
                >
                  <span className="vod-detail-play-icon" aria-hidden>▶</span>
                  {t('vod.play')}
                </FocusableButton>
              </div>
            </div>
          </div>

          {/* Episodes (series) */}
          {isSeries && !loading && seriesInfo?.episodes?.length > 0 && (
            <div className="vod-detail-episodes">
              <h3 className="vod-detail-episodes-title">{t('vod.episodes')}</h3>
              <ul className="vod-detail-episodes-list">
                {seriesInfo.episodes.map((ep, i) => (
                  <EpisodeItem
                    key={ep.id ?? ep.vodId ?? i}
                    episode={ep}
                    index={i}
                    baseUrl={baseUrl}
                    onPlay={() => handlePlay(ep)}
                  />
                ))}
              </ul>
            </div>
          )}
          {isSeries && !loading && seriesInfo && (!seriesInfo.episodes || seriesInfo.episodes.length === 0) && (
            <div className="vod-detail-actions vod-detail-actions-fallback">
              <FocusableButton
                type="button"
                className="vod-detail-play-btn"
                onClick={handlePlayCurrent}
                focusKey="vod-detail-play-fallback"
              >
                <span className="vod-detail-play-icon" aria-hidden>▶</span>
                {t('vod.play')}
              </FocusableButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EpisodeItem({ episode, index, baseUrl, onPlay }) {

  const name = episode.name ?? episode.title ?? episode.episodeTitle ?? `Episode ${index + 1}`;
  const thumbUrl =
    episode.posterListURL ??
    (episode.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, episode.image1Id, 'posterList') : null);
  const duration = episode.duration != null && episode.duration > 0 ? Math.floor(episode.duration / 60) : null;

  return (
    <li className="vod-episode-item">
      <FocusableButton
        type="button"
        className="vod-episode-btn"
        onClick={onPlay}
        focusKey={`vod-episode-${index}`}
      >
        <div className="vod-episode-thumb">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" />
          ) : (
            <div className="vod-episode-thumb-placeholder" />
          )}
          <span className="vod-episode-play-icon" aria-hidden>▶</span>
        </div>
        <div className="vod-episode-info">
          <span className="vod-episode-name">{name}</span>
          {duration != null && duration > 0 && (
            <span className="vod-episode-duration">{duration} min</span>
          )}
        </div>
      </FocusableButton>
    </li>
  );
}

export default VodDetailModal;
