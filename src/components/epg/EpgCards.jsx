import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '../../contexts/PlayerContext';
import { useDevice } from '../../contexts/DeviceContext';
import { usePreload } from '../../store/usePreload';
import { useBrand } from '../../contexts/BrandContext';
import { useNavigate } from 'react-router-dom';
import panaccessService from '../../services/panaccessService';
import EpgEventModal from './EpgEventModal';
import '../epg/epg-common.scss';

function asMs(dateLike) {
  if (dateLike == null) return null;
  if (typeof dateLike?.valueOf === 'function') {
    const v = dateLike.valueOf();
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  }
  if (typeof dateLike === 'number') return dateLike;
  const d = new Date(dateLike);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function formatHHmm(ms) {
  if (!ms || Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function getSortedEvents(epgItems) {
  const list = Array.isArray(epgItems) ? [...epgItems] : [];
  list.sort((a, b) => (asMs(a?.startDate) ?? 0) - (asMs(b?.startDate) ?? 0));
  return list;
}

function computeSlots(epgItems, { nowMs, epgPastEnabled = false } = {}) {
  const events = getSortedEvents(epgItems);
  if (!events.length)
    return { before: null, now: null, next: null, later: null, isLive: false };
  if (nowMs == null) return { before: null, now: null, next: null, later: null, isLive: false };

  let idxNow = events.findIndex((ev) => {
    const s = asMs(ev?.startDate);
    const e = asMs(ev?.endDate);
    if (s == null || e == null) return false;
    return nowMs >= s && nowMs <= e;
  });

  // Si no hay evento live, usamos:
  // - primer evento futuro como "now"
  // - si no hay futuro, el último evento como "now"
  if (idxNow < 0) {
    idxNow = events.findIndex((ev) => {
      const s = asMs(ev?.startDate);
      if (s == null) return false;
      return s > nowMs;
    });
    if (idxNow < 0) idxNow = events.length - 1;
  }

  const now = events[idxNow] ?? null;
  const before = epgPastEnabled ? events[idxNow - 1] ?? null : null;
  const next = events[idxNow + 1] ?? null;
  const later = events[idxNow + 2] ?? null;

  const isLive = (() => {
    if (!now) return false;
    const s = asMs(now?.startDate);
    const e = asMs(now?.endDate);
    if (s == null || e == null) return false;
    return nowMs >= s && nowMs <= e;
  })();

  return { before, now, next, later, isLive };
}

function Card({
  onEnter,
  title,
  timeText,
  isLive,
  progressPercent,
  disabled,
}) {
  const localElRef = useRef(null);

  const handleFocus = () => {
    const el = localElRef.current;
    const container = el?.closest?.('.epg-cards-grid') || null;

    if (!el) return;

    if (container) {
      const cTop = container.getBoundingClientRect().top;
      const cBottom = cTop + container.clientHeight;
      const elTop = el.getBoundingClientRect().top;
      const elBottom = elTop + el.offsetHeight;

      if (elTop < cTop) {
        container.scrollTop -= cTop - elTop;
      } else if (elBottom > cBottom) {
        container.scrollTop += elBottom - cBottom;
      }
      return;
    }

    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  return (
    <div
      ref={localElRef}
      className={`epg-card ${disabled ? 'disabled' : ''} ${isLive ? 'epg-card--live-now' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onFocus={handleFocus}
      onClick={() => {
        if (disabled) return;
        onEnter?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!disabled) onEnter?.();
        }
      }}
    >
      <div className="epg-card-slot-title">{title || '—'}</div>
      <div className="epg-card-slot-time">{timeText || ''}</div>
      {isLive && progressPercent != null && (
        <div className="epg-card-live-progress">
          <div className="epg-card-live-progress-fill" style={{ width: `${clamp(progressPercent, 0, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export function EpgCards({ onSelect }) {
  const { t } = useTranslation();
  const { epg } = usePreload();
  const { currentBrand } = useBrand();
  const { play } = usePlayer();
  const { isTV } = useDevice();
  const navigate = useNavigate();

  const epgCardsCfg = currentBrand?.epgCards || {};
  const epgPastEnabled = !!epgCardsCfg.epgPast;
  const closeModalOnPlayLive =
    typeof epgCardsCfg.epgCloseModalOnPlayLive === 'boolean'
      ? epgCardsCfg.epgCloseModalOnPlayLive
      : isTV;

  const [detail, setDetail] = useState(null); // { channel, event, isLive }

  const showRating = !!currentBrand?.features?.showRating;

  // Reloj para calcular "Ahora" / progreso live sin usar Date.now durante render.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const channels = useMemo(() => {
    const streams = epg?.streams || [];
    // Mantener orden estable por LCN si existe (no depende del tick)
    return [...streams].sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));
  }, [epg?.streams]);

  const resolveChannelLiveUrl = (channel) => {
    if (!channel) return null;
    let url =
      channel.url ||
      channel.streamUrl ||
      channel.hlsUrl ||
      channel.hls ||
      null;
    if (!url) {
      const streamId = channel.id ?? channel.epgStreamId;
      if (streamId != null && streamId !== '') {
        try {
          url = panaccessService.getStreamM3u8Url({ streamId });
        } catch (e) {
          if (import.meta.env?.DEV) {
            console.warn('[EpgCards] getStreamM3u8Url error:', e?.message || e);
          }
        }
      }
    }
    try {
      url = panaccessService.normalizePlaybackUrl(url);
    } catch (e) {
      if (import.meta.env?.DEV) {
        console.warn('[EpgCards] normalizePlaybackUrl error:', e?.message || e);
      }
    }
    return url || null;
  };

  const handlePlayLive = (channel) => {
    const url = resolveChannelLiveUrl(channel);
    if (!url) return false;
    play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true });
    return true;
  };

  const canPlayLive = !!resolveChannelLiveUrl(detail?.channel);

  return (
    <div className="epg-cards-page">
      <div className="epg-cards-header">
        <h1 className="epg-cards-title">{t('epg.title', { defaultValue: 'EPG' })}</h1>
        <div className="epg-cards-subtitle">
          {t('epg.subtitle', { defaultValue: 'Selecciona un programa' })}
        </div>
      </div>

      <div className="epg-cards-grid">
        <div className="epg-cards-table-header">
          <div className="epg-cards-table-header-channel">
            {t('epg.channel', { defaultValue: 'Canal' })}
          </div>
          <div
            className="epg-cards-row-cards epg-cards-row-cards--header"
            style={{ ['--epg-cards-cols']: epgPastEnabled ? 4 : 3 }}
          >
            {epgPastEnabled && (
              <div className="epg-cards-slot-header">
                {t('epg.before', { defaultValue: 'Antes' })}
              </div>
            )}
            <div className="epg-cards-slot-header">
              {t('epg.now', { defaultValue: 'Ahora' })}
            </div>
            <div className="epg-cards-slot-header">
              {t('epg.next', { defaultValue: 'Siguiente' })}
            </div>
            <div className="epg-cards-slot-header">
              {t('epg.later', { defaultValue: 'Más tarde' })}
            </div>
          </div>
        </div>

        {channels.map((channel) => {
          const { before, now, next, later, isLive } = computeSlots(channel.epgItems, {
            nowMs,
            epgPastEnabled,
          });

          const channelImg =
            channel?.img ||
            channel?.imageUrl ||
            channel?.logoUrl ||
            channel?.logo ||
            channel?.icon ||
            null;

          const nowStart = asMs(now?.startDate);
          const nowEnd = asMs(now?.endDate);
          const nowProgress =
            now && isLive && nowStart != null && nowEnd != null
              ? ((nowMs - nowStart) / (nowEnd - nowStart)) * 100
              : null;

          const beforeStart = asMs(before?.startDate);
          const beforeEnd = asMs(before?.endDate);
          const nowTitle = now?.languages?.[0]?.title || now?.title || '';
          const beforeTitle = before?.languages?.[0]?.title || before?.title || '';
          const nextTitle = next?.languages?.[0]?.title || next?.title || '';
          const laterTitle = later?.languages?.[0]?.title || later?.title || '';

          const beforeTime =
            beforeStart != null && beforeEnd != null
              ? `${formatHHmm(beforeStart)} - ${formatHHmm(beforeEnd)}`
              : '';
          const nowTime =
            nowStart != null ? `${formatHHmm(nowStart)} - ${formatHHmm(nowEnd)}` : '';
          const nextTime = (() => {
            const s = asMs(next?.startDate);
            const e = asMs(next?.endDate);
            return s != null && e != null ? `${formatHHmm(s)} - ${formatHHmm(e)}` : '';
          })();
          const laterTime = (() => {
            const s = asMs(later?.startDate);
            const e = asMs(later?.endDate);
            return s != null && e != null ? `${formatHHmm(s)} - ${formatHHmm(e)}` : '';
          })();

          return (
            <div key={channel.id ?? channel.lcn} className="epg-cards-row">
              <div
                className="epg-cards-channel"
                style={
                  isLive
                    ? {
                        backgroundColor:
                          epgCardsCfg.epgCardsChannelActiveBg || 'rgba(10, 67, 133, 0.3)',
                        padding: 8,
                        borderRadius: 14,
                      }
                    : undefined
                }
              >
                <div className="epg-cards-channel-lcn">{channel.lcn ?? ''}</div>
                {channelImg ? (
                  <img
                    className="epg-cards-channel-logo"
                    src={channelImg}
                    alt={channel.name ?? ''}
                    onError={(e) => {
                      // Ocultar si falla la carga (misma idea de legacy onerror).
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="epg-cards-channel-name">{channel.name ?? ''}</div>
                {showRating && typeof channel.parentalRating !== 'undefined' && channel.parentalRating != null ? (
                  <div className="epg-cards-channel-rating">+{channel.parentalRating}</div>
                ) : null}
              </div>

              <div className="epg-cards-row-cards" style={{ ['--epg-cards-cols']: epgPastEnabled ? 4 : 3 }}>
                {epgPastEnabled && (
                  <Card
                    disabled={!before}
                    onEnter={() => {
                      setDetail({ channel, event: before, isLive: false });
                      onSelect?.({ channel, event: before, isLive: false });
                    }}
                    title={beforeTitle}
                    timeText={beforeTime}
                    isLive={false}
                  />
                )}
                <Card
                  disabled={!now}
                  onEnter={() => {
                    setDetail({ channel, event: now, isLive });
                    onSelect?.({ channel, event: now, isLive });
                  }}
                  title={nowTitle}
                  timeText={nowTime}
                  isLive={isLive}
                  progressPercent={nowProgress}
                />
                <Card
                  disabled={!next}
                  onEnter={() => {
                    setDetail({ channel, event: next, isLive: false });
                    onSelect?.({ channel, event: next, isLive: false });
                  }}
                  title={nextTitle}
                  timeText={nextTime}
                  isLive={false}
                />
                <Card
                  disabled={!later}
                  onEnter={() => {
                    setDetail({ channel, event: later, isLive: false });
                    onSelect?.({ channel, event: later, isLive: false });
                  }}
                  title={laterTitle}
                  timeText={laterTime}
                  isLive={false}
                />
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <EpgEventModal
          open
          channel={detail.channel}
          event={detail.event}
          isLive={detail.isLive}
          canPlayLive={canPlayLive}
          onClose={() => setDetail(null)}
          onPlayLive={() => {
            const started = handlePlayLive(detail.channel);
            if (started && closeModalOnPlayLive) {
              setDetail(null);
            }
          }}
          onWatchCatchup={(catchupId) => {
            if (!catchupId) return;
            navigate('/home/catchup', { state: { catchupId, from: 'epg' }, replace: false });
          }}
        />
      )}
    </div>
  );
}

export default EpgCards;

