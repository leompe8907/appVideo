import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import { usePlayer } from '../../contexts/PlayerContext';
import { usePreload } from '../../contexts/PreloadContext';
import { useBrand } from '../../contexts/BrandContext';
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

function computeSlots(epgItems) {
  const events = getSortedEvents(epgItems);
  if (!events.length) return { now: null, next: null, later: null, isLive: false };

  const nowMs = Date.now();

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
  const next = events[idxNow + 1] ?? null;
  const later = events[idxNow + 2] ?? null;

  const isLive = (() => {
    if (!now) return false;
    const s = asMs(now?.startDate);
    const e = asMs(now?.endDate);
    if (s == null || e == null) return false;
    return nowMs >= s && nowMs <= e;
  })();

  return { now, next, later, isLive };
}

function Card({
  focusKey,
  onEnter,
  title,
  timeText,
  isLive,
  progressPercent,
  disabled,
}) {
  const { ref, focused } = useSpatialNavigation({
    focusKey,
    isFocusable: !disabled,
    onEnterPress: disabled ? undefined : onEnter,
  });

  return (
    <div
      ref={ref}
      className={`epg-card ${focused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
      role="button"
      tabIndex={-1}
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

  const streams = epg?.streams || [];

  const [detail, setDetail] = useState(null); // { channel, event, isLive }

  const showRating = !!currentBrand?.features?.showRating;

  // Tick para actualizar progreso live (1s es suficiente para UI)
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const channels = useMemo(() => {
    // Mantener orden estable por LCN si existe (no depende del tick)
    return [...streams].sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));
  }, [streams]);

  const handlePlayLive = (channel) => {
    if (!channel) return;
    let url =
      channel.url ||
      channel.streamUrl ||
      channel.hlsUrl ||
      channel.hls ||
      null;
    if (!url) {
      const streamId = channel.id ?? channel.epgStreamId;
      if (streamId != null && streamId !== '') {
        url = panaccessService.getStreamM3u8Url({ streamId });
      }
    }
    if (!url) return;
    play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true });
  };

  return (
    <div className="epg-cards-page">
      <div className="epg-cards-header">
        <h1 className="epg-cards-title">{t('epg.title', { defaultValue: 'EPG' })}</h1>
        <div className="epg-cards-subtitle">
          {t('epg.subtitle', { defaultValue: 'Selecciona un programa' })}
        </div>
      </div>

      <div className="epg-cards-grid">
        {channels.map((channel) => {
          const { now, next, later, isLive } = computeSlots(channel.epgItems);

          const nowStart = asMs(now?.startDate);
          const nowEnd = asMs(now?.endDate);
          const nowProgress =
            now && isLive && nowStart != null && nowEnd != null
              ? ((Date.now() - nowStart) / (nowEnd - nowStart)) * 100
              : null;

          const nowTitle = now?.languages?.[0]?.title || now?.title || '';
          const nextTitle = next?.languages?.[0]?.title || next?.title || '';
          const laterTitle = later?.languages?.[0]?.title || later?.title || '';

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
              <div className="epg-cards-channel">
                <div className="epg-cards-channel-lcn">{channel.lcn ?? ''}</div>
                <div className="epg-cards-channel-name">{channel.name ?? ''}</div>
                {showRating && typeof channel.parentalRating !== 'undefined' && channel.parentalRating != null ? (
                  <div className="epg-cards-channel-rating">+{channel.parentalRating}</div>
                ) : null}
              </div>

              <div className="epg-cards-row-cards">
                <Card
                  focusKey={`epg-${channel.id ?? channel.lcn}-now`}
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
                  focusKey={`epg-${channel.id ?? channel.lcn}-next`}
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
                  focusKey={`epg-${channel.id ?? channel.lcn}-later`}
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

      <EpgEventModal
        open={!!detail}
        channel={detail?.channel}
        event={detail?.event}
        isLive={detail?.isLive}
        onClose={() => setDetail(null)}
        onPlayLive={() => handlePlayLive(detail?.channel)}
      />
    </div>
  );
}

export default EpgCards;

