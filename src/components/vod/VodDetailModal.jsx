/**
 * Modal de detalle VOD: estilo Hero + capas (Netflix/Disney+).
 * Película: reproducir. Serie: lista de episodios y reproducir.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevice } from '../../contexts/DeviceContext';
import { usePlayer } from '../../contexts/PlayerContext';
import panaccessService from '../../services/panaccessService';
import { getVodImageUrl } from '../../services/vodService';
import { useBrand } from '../../contexts/BrandContext';
import { FocusableButton } from '../navigation/FocusableButton';
import AppIcon from '../AppIcon';
import { requestTvFocusRingSync } from '../navigation/TvFocusRing';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';

const DESCRIPTION_MAX_LENGTH = 180;

export function VodDetailModal({ item, categories = [], onClose, onPlay, infoOnly = false }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { isTV } = useDevice();
  const { state: playerState } = usePlayer();
  const playerActiveRef = useRef(Boolean(playerState?.url));
  const wasPlayerActiveRef = useRef(Boolean(playerState?.url));
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('vod-detail-modal');
  const baseUrl = currentBrand?.drm || '';
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [loading, setLoading] = useState(!!item?.isSeries);
  const [error, setError] = useState(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [extraMeta, setExtraMeta] = useState(null);

  // TV: al cambiar "Ver más/Ver menos" el tamaño del botón cambia sin cambiar el foco.
  // Forzar re-sync del TvFocusRing para que el borde se ajuste al texto.
  useEffect(() => {
    if (!isTV) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    if (!active.classList.contains('vod-detail-read-more')) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => requestTvFocusRingSync());
    });
  }, [isTV, descriptionExpanded]);

  useEffect(() => {
    playerActiveRef.current = Boolean(playerState?.url);
  }, [playerState?.url]);

  // Navegación (LEFT/RIGHT/UP/DOWN por geometría, BACK) delegada al motor central:
  // esta zona se registra en FocusManager en vez de tener su propio listener de keydown.
  useEffect(() => {
    if (!item) return undefined;
    const zoneId = zoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: rootRef.current,
      onBack: () => {
        // Player activo: BACK lo gestiona PlayerHud (mismo criterio que botón volver en pantalla).
        if (playerActiveRef.current) return false;
        onClose?.();
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [item, onClose]);

  useEffect(() => {
    if (!isTV || loading) return undefined;
    const t = setTimeout(() => {
      const id = infoOnly ? 'player-vod-info-close' : 'vod-detail-play';
      focusElementSafe(document.getElementById(id));
    }, 400);
    return () => clearTimeout(t);
  }, [isTV, loading, infoOnly]);

  // TV: al cerrar el player con BACK del control, volver a enfocar Reproducir (como botón en pantalla).
  useEffect(() => {
    if (!isTV || infoOnly || loading) return undefined;

    const isPlayerActive = Boolean(playerState?.url);
    const wasActive = wasPlayerActiveRef.current;
    wasPlayerActiveRef.current = isPlayerActive;

    if (isPlayerActive || !wasActive) return undefined;

    const t = setTimeout(() => {
      const btn = document.getElementById('vod-detail-play');
      if (btn instanceof HTMLElement) btn.focus();
    }, 400);

    return () => clearTimeout(t);
  }, [isTV, infoOnly, loading, playerState?.url]);

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
          .split(/[,|;]/g)
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
      // No cerrar aquí: al salir del reproductor se debe volver a este detalle (TV y web).
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
    <div ref={rootRef} className="vod-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="vod-detail-title">
      <div className="vod-detail-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="vod-detail-modal vod-detail-hero-layout">
        {/* Hero background */}
        <div
          className="vod-detail-hero"
          style={heroImageUrl ? { backgroundImage: `url(${heroImageUrl})` } : undefined}
        >
          <div className="vod-detail-hero-gradient" />
        </div>

        {/* Cerrar: PC siempre; TV en modo infoOnly (desde player) */}
        {(!isTV || infoOnly) ? (
          <FocusableButton
            type="button"
            className="vod-detail-close"
            id={infoOnly ? 'player-vod-info-close' : undefined}
            data-tv-nav={infoOnly ? 'vod-detail' : undefined}
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Cerrar' })}
          >
            <AppIcon name="close" size={18} className="vod-detail-close-icon" />
          </FocusableButton>
        ) : null}

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
                      data-tv-nav="vod-detail"
                      onClick={() => setDescriptionExpanded((v) => !v)}
                    >
                      {descriptionExpanded ? t('vod.readLess') : t('vod.readMore')}
                    </FocusableButton>
                  )}
                </div>
              )}
              {error && <p className="vod-detail-error">{error}</p>}
              {loading && <p className="vod-detail-loading">{t('vod.loading')}</p>}
              {!infoOnly ? (
                <div className="vod-detail-actions">
                  <FocusableButton
                    type="button"
                    className="vod-detail-play-btn"
                    data-tv-nav="vod-detail"
                    onClick={handlePlayCurrent}
                    id="vod-detail-play"
                  >
                    <span className="vod-detail-play-icon" aria-hidden>
                      <AppIcon name="play" size={18} />
                    </span>
                    {t('vod.play')}
                  </FocusableButton>
                </div>
              ) : null}
            </div>
          </div>

          {/* Episodes (series) */}
          {!infoOnly && isSeries && !loading && seriesInfo?.episodes?.length > 0 && (
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
          {!infoOnly && isSeries && !loading && seriesInfo && (!seriesInfo.episodes || seriesInfo.episodes.length === 0) && (
            <div className="vod-detail-actions vod-detail-actions-fallback">
              <FocusableButton
                type="button"
                className="vod-detail-play-btn"
                data-tv-nav="vod-detail"
                onClick={handlePlayCurrent}
              >
                <span className="vod-detail-play-icon" aria-hidden>
                  <AppIcon name="play" size={18} />
                </span>
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
        data-tv-nav="vod-detail"
        onClick={onPlay}
      >
        <div className="vod-episode-thumb">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" />
          ) : (
            <div className="vod-episode-thumb-placeholder" />
          )}
          <span className="vod-episode-play-icon" aria-hidden>
            <AppIcon name="play" size={16} />
          </span>
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
