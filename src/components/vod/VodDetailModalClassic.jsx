/**
 * Modal de detalle VOD estilo 10foot (clásico).
 * Layout: mitad superior = poster (30%) + info (70%); mitad inferior = "Parecidos" (vacío por ahora).
 * Series: columna izquierda poster+info, derecha lista de episodios.
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevice } from '../../contexts/DeviceContext';
import panaccessService from '../../services/panaccessService';
import { getVodImageUrl } from '../../services/vodService';
import { useBrand } from '../../contexts/BrandContext';
import { FocusableButton } from '../navigation/FocusableButton';

export function VodDetailModalClassic({ item, categories = [], onClose, onPlay }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { isTV } = useDevice();
  const baseUrl = currentBrand?.drm || '';
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [loading, setLoading] = useState(!!item?.isSeries);
  const [error, setError] = useState(null);
  const [extraMeta, setExtraMeta] = useState(null);

  useEffect(() => {
    if (isTV && !loading) {
      const t = setTimeout(() => {
        const btn = document.getElementById('vod-classic-play');
        if (btn) btn.focus();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isTV, loading]);

  const isSeries = item?.isSeries === true;
  const title = item?.name || item?.title || '';
  const description = item?.description || seriesInfo?.description || '';

  const posterUrl =
    item?.extraImageURL ||
    item?.posterInfoURL ||
    item?.posterListURL ||
    (item?.image1Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image1Id, 'posterInfo') : null) ||
    (item?.image2Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image2Id, 'original') : null) ||
    (item?.image3Id != null && baseUrl ? getVodImageUrl(baseUrl, item.image3Id, 'original') : null);

  const duration = item?.duration != null && item.duration > 0 ? Math.floor(item.duration / 60) : 0;
  const durationString = duration > 0 ? `${duration} ${t('vod.minutes')}` : '';
  const rating = item?.rating != null ? Number(item.rating) / 10 : 0;

  const categoryLabel = (() => {
    if (item?.categoryName) return item.categoryName;
    const ids = Array.isArray(item?.categories) ? item.categories : [];
    const names = ids
      .map((id) => categories.find((c) => c.id === id || c.id === Number(id) || String(c.id) === String(id))?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : '';
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
    <div className="vod-detail-overlay vod-detail-overlay--classic" role="dialog" aria-modal="true" aria-labelledby="vod-detail-classic-title">
      <div className="vod-detail-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="vod-detail-modal vod-detail-modal--classic">
        {!isTV && (
          <button type="button" className="vod-detail-close vod-detail-close--classic" onClick={onClose} aria-label={t('common.close')}>
            {t('common.close')}
          </button>
        )}

        {!isSeries && (
          <div className="vod-detail-container vod-detail-container--classic">
            <div className="vod-classic-container-top">
              <div className="vod-classic-top-left">
                <div className="vod-classic-poster-wrap">
                  {posterUrl ? <img src={posterUrl} alt="" className="vod-classic-picture" /> : <div className="vod-detail-poster-placeholder" />}
                </div>
                <FocusableButton
                  type="button"
                  className="vod-classic-play"
                  onClick={handlePlayCurrent}
                  id="vod-classic-play"
                  aria-label={t('vod.play')}
                >
                  <i className="vod-classic-play-icon" aria-hidden>▶</i>
                </FocusableButton>
              </div>
              <div className="vod-classic-top-right">
                <h2 id="vod-detail-classic-title" className="vod-classic-title">{title}</h2>
                {categoryLabel && <div className="vod-classic-category">{categoryLabel}</div>}
                <div className="vod-classic-subtitle">
                  <div className="vod-classic-time">{durationString}</div>
                  <div className="vod-classic-rating">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`vod-classic-star ${i <= Math.floor(rating) ? 'fill' : rating > i - 1 && rating < i ? 'half' : ''}`}
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
                {directorsList.length > 0 ? (
                  <div className="vod-classic-description" style={{ marginTop: 8 }}>
                    <strong>{t('vod.directors', { defaultValue: 'Dirección' })}:</strong> {directorsList.join(', ')}
                  </div>
                ) : null}
                {castList.length > 0 ? (
                  <div className="vod-classic-description" style={{ marginTop: 6 }}>
                    <strong>{t('vod.cast', { defaultValue: 'Reparto' })}:</strong> {castList.join(', ')}
                  </div>
                ) : null}
                {description && <div className="vod-classic-description">{description}</div>}
                {error && <p className="vod-detail-error">{error}</p>}
              </div>
            </div>
            <div className="vod-classic-container-bottom" />
          </div>
        )}

        {isSeries && (
          <div className="vod-detail-serie-container vod-detail-serie-container--classic">
            <div className="vod-classic-serie-row">
              <div className="vod-classic-serie-left">
                <div className="vod-classic-serie-poster-wrap">
                  {posterUrl ? <img src={posterUrl} alt="" className="vod-classic-serie-picture" /> : <div className="vod-detail-poster-placeholder" />}
                </div>
                <div className="vod-classic-serie-info">
                  <h2 id="vod-detail-classic-title" className="vod-classic-title">{title}</h2>
                  {categoryLabel && <div className="vod-classic-category">{categoryLabel}</div>}
                  <div className="vod-classic-subtitle">
                    <div className="vod-classic-time">{durationString}</div>
                    <div className="vod-classic-rating">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={`vod-classic-star ${i <= Math.floor(rating) ? 'fill' : ''}`} aria-hidden />
                      ))}
                    </div>
                  </div>
                  {directorsList.length > 0 ? (
                    <div className="vod-classic-description" style={{ marginTop: 8 }}>
                      <strong>{t('vod.directors', { defaultValue: 'Dirección' })}:</strong> {directorsList.join(', ')}
                    </div>
                  ) : null}
                  {castList.length > 0 ? (
                    <div className="vod-classic-description" style={{ marginTop: 6 }}>
                      <strong>{t('vod.cast', { defaultValue: 'Reparto' })}:</strong> {castList.join(', ')}
                    </div>
                  ) : null}
                  {description && <div className="vod-classic-description">{description}</div>}
                </div>
              </div>
              <div className="vod-classic-serie-right">
                <h3 className="vod-classic-episodes-label">{t('vod.episodes')}</h3>
                {loading && <p className="vod-detail-loading">{t('vod.loading')}</p>}
                {error && <p className="vod-detail-error">{error}</p>}
                {!loading && seriesInfo?.episodes?.length > 0 && (
                  <ul className="vod-classic-episodes-list">
                    {seriesInfo.episodes.map((ep, i) => (
                      <ClassicEpisodeItem key={ep.id ?? ep.vodId ?? i} episode={ep} index={i} onPlay={() => handlePlay(ep)} />
                    ))}
                  </ul>
                )}
                {!loading && seriesInfo && (!seriesInfo.episodes || seriesInfo.episodes.length === 0) && (
                  <FocusableButton type="button" className="vod-classic-play-btn-inline" onClick={handlePlayCurrent}>
                    {t('vod.play')}
                  </FocusableButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClassicEpisodeItem({ episode, index, onPlay }) {
  const name = episode.name ?? episode.title ?? episode.episodeTitle ?? `Episode ${index + 1}`;
  return (
    <li className="vod-classic-episode-item">
      <FocusableButton type="button" className="vod-classic-episode-btn" onClick={onPlay}>
        <span className="vod-classic-episode-play" aria-hidden>▶</span>
        <span className="vod-classic-episode-name">{name}</span>
      </FocusableButton>
    </li>
  );
}

export default VodDetailModalClassic;
