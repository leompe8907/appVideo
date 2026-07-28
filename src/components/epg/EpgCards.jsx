import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '../../contexts/PlayerContext';
import { usePreload } from '../../store/usePreload';
import { useBrand } from '../../contexts/BrandContext';
import { useNavigate } from 'react-router-dom';
import panaccessService from '../../services/panaccessService';
import EpgEventModal from './EpgEventModal';
import { useParentalGate } from '../../hooks/useParentalGate';
import { useEpgReminderStore } from '../../store/epgReminderStore';
import { getChannelStableId, dedupeStreams } from '../../utils/channelId';
import { useTvInitialFocus } from '../../hooks/useTvInitialFocus';
import { asMs, clamp, computeLiveProgressStyle, computeSlots, formatHHmm } from './epgSlots';
import '../epg/epg-common.scss';

/**
 * Barra de progreso del evento "en vivo" animada por CSS en vez de por React.
 *
 * Antes el % de avance se recalculaba en cada render del padre (disparado por
 * el `setInterval(1000ms)` de `EpgCards`) y se aplicaba como `width` inline —
 * es decir, un re-render de TODA la grilla cada segundo solo para mover esta
 * barra. Acá el efecto corre una única vez por evento (cuando cambian
 * `startMs`/`endMs`, no en cada tick de reloj): fija el % actual sin
 * transición, fuerza reflow, y dispara una transición CSS lineal hasta 100%
 * con una duración igual al tiempo restante real del evento. El navegador se
 * encarga de animarla fotograma a fotograma sin JS de por medio.
 */
const EpgLiveProgress = memo(function EpgLiveProgress({ startMs, endMs }) {
  const fillRef = useRef(null);

  useEffect(() => {
    const el = fillRef.current;
    const progress = computeLiveProgressStyle(startMs, endMs);
    if (!el || !progress) return undefined;
    const { elapsedPercent, remainingMs } = progress;

    el.style.transition = 'none';
    el.style.width = `${clamp(elapsedPercent, 0, 100)}%`;

    if (remainingMs <= 0) return undefined;

    // Forzar reflow: sin esto el navegador puede "coalescer" el cambio de
    // `width` de arriba con la transición de abajo y saltar directo a 100%.
    void el.offsetWidth;
    el.style.transition = `width ${remainingMs}ms linear`;
    el.style.width = '100%';
    return undefined;
  }, [startMs, endMs]);

  return (
    <div className="epg-card-live-progress">
      <div ref={fillRef} className="epg-card-live-progress-fill" />
    </div>
  );
});

const Card = memo(function Card({
  id,
  onEnter,
  title,
  timeText,
  isLive,
  progressStartMs,
  progressEndMs,
  disabled,
}) {
  return (
    <div
      id={id}
      className={`epg-card ${disabled ? 'disabled' : ''} ${isLive ? 'epg-card--live-now' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
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
      {isLive && progressStartMs != null && progressEndMs != null && (
        <EpgLiveProgress startMs={progressStartMs} endMs={progressEndMs} />
      )}
    </div>
  );
});

export function EpgCards({ onSelect }) {
  const { t } = useTranslation();
  const { epg } = usePreload();
  const { currentBrand } = useBrand();
  const { play } = usePlayer();
  const { requestPlayChannel } = useParentalGate();
  const navigate = useNavigate();
  const addReminder = useEpgReminderStore((s) => s.addReminder);
  const removeReminder = useEpgReminderStore((s) => s.removeReminder);
  const hasReminder = useEpgReminderStore((s) => s.hasReminder);

  const epgCardsCfg = currentBrand?.EPG || {};
  const epgPastEnabled = !!epgCardsCfg.epgPast;
  const [detail, setDetail] = useState(null); // { channel, event, isLive }

  const showRating = !!currentBrand?.features?.showRating;

  // Reloj para calcular qué evento es "Antes/Ahora/Siguiente/Más tarde".
  // Antes corría a 1000ms y forzaba un re-render de TODA la tabla (todos los
  // canales, todas las tarjetas) cada segundo — el único motivo para esa
  // cadencia era la barra de progreso del evento en vivo, que ahora se anima
  // por CSS (ver `EpgLiveProgress`) y no depende de este estado. Lo que sí
  // sigue necesitando este reloj es detectar cuándo el evento "ahora" termina
  // y hay que correr la fila (antes/ahora/siguiente/más tarde) — algo que no
  // requiere precisión de 1 segundo, así que 15s es un compromiso razonable
  // entre "se nota rápido el cambio de programa" y "no recalcula la grilla
  // entera 60 veces por minuto".
  const NOW_TICK_MS = 15000;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), NOW_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const channels = useMemo(() => {
    const streams = dedupeStreams(epg?.streams || []);
    return [...streams].sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));
  }, [epg?.streams]);

  // Navegación LEFT/RIGHT/UP/DOWN por geometría (motor central); las tarjetas
  // deshabilitadas (tabIndex=-1) quedan fuera de los candidatos automáticamente.
  // El modal de detalle, al abrirse, se registra como su propia zona en
  // FocusManager y escopa el foco dentro de sí mismo.
  useTvInitialFocus('.epg-cards-page .epg-cards-grid', [channels.length]);

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
          if (import.meta.env.DEV) {
            console.warn('[EpgCards] getStreamM3u8Url error:', e?.message || e);
          }
        }
      }
    }
    try {
      url = panaccessService.normalizePlaybackUrl(url);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[EpgCards] normalizePlaybackUrl error:', e?.message || e);
      }
    }
    return url || null;
  };

  const handlePlayLive = (channel) => {
    const url = resolveChannelLiveUrl(channel);
    if (!url) return false;
    requestPlayChannel({
      channel,
      playFn: () =>
        play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true }),
    });
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

        {channels.map((channel, rowIdx) => {
          const { before, now, next, later, isLive } = computeSlots(channel.epgItems, {
            nowMs,
            epgPastEnabled,
          });

          // Canal sin datos de EPG (`now` es null: backend caído, canal nuevo
          // sin programación cargada, etc.): antes esto dejaba las 4 tarjetas
          // (antes/ahora/siguiente/más tarde) deshabilitadas y el canal
          // quedaba completamente inaccesible — ni un clic en PC ni el mando
          // de TV podían hacer nada, porque ambos dependen del mismo
          // `disabled`/`tabIndex` de la tarjeta. Un canal en vivo no necesita
          // metadata de programación para poder reproducirse, así que la
          // tarjeta "Ahora" se habilita igual si el canal resuelve una URL de
          // stream, mostrando el detalle sin información de programa (el
          // modal ya soporta `event=null`) en vez de dejar la fila muerta.
          const channelPlayable = !now && !!resolveChannelLiveUrl(channel);
          const nowIsLive = isLive || channelPlayable;

          const channelImg =
            channel?.img ||
            channel?.imageUrl ||
            channel?.logoUrl ||
            channel?.logo ||
            channel?.icon ||
            null;

          const nowStart = asMs(now?.startDate);
          const nowEnd = asMs(now?.endDate);

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
            <div key={getChannelStableId(channel) || channel.lcn} className="epg-cards-row">
              <div
                className="epg-cards-channel"
                style={
                  nowIsLive
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
                    id={`epg-card-${rowIdx}-0`}
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
                  id={`epg-card-${rowIdx}-${epgPastEnabled ? 1 : 0}`}
                  disabled={!now && !channelPlayable}
                  onEnter={() => {
                    setDetail({ channel, event: now || null, isLive: nowIsLive });
                    onSelect?.({ channel, event: now || null, isLive: nowIsLive });
                  }}
                  title={
                    nowTitle ||
                    (channelPlayable
                      ? channel.name || t('epg.playLiveChannel', { defaultValue: 'Reproducir canal (en vivo)' })
                      : '')
                  }
                  timeText={nowTime}
                  isLive={nowIsLive}
                  progressStartMs={nowStart}
                  progressEndMs={nowEnd}
                />
                <Card
                  id={`epg-card-${rowIdx}-${epgPastEnabled ? 2 : 1}`}
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
                  id={`epg-card-${rowIdx}-${epgPastEnabled ? 3 : 2}`}
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
          nowMs={nowMs}
          remindActive={(() => {
            const ev = detail?.event;
            const id = String(ev?.event_id ?? ev?.eventId ?? ev?.id ?? '');
            return id ? hasReminder(id) : false;
          })()}
          canPlayLive={canPlayLive}
          onClose={() => setDetail(null)}
          onPlayLive={() => {
            // Requerimiento UX: al iniciar reproducción desde detalle, cerrar SIEMPRE el modal
            // para que no quede overlay sobre el player (y para evitar dobles overlays con PIN gate).
            setDetail(null);
            handlePlayLive(detail.channel);
          }}
          onWatchCatchup={(catchupStreamId, event) => {
            if (catchupStreamId == null) return;
            const epgStreamId =
              detail?.channel?.epgStreamId ??
              detail?.channel?.epg_stream_id ??
              event?.epgStreamId ??
              event?.epg_stream_id ??
              null;
            navigate('/home/catchup', {
              state: { catchupId: catchupStreamId, epgStreamId, from: 'epg' },
              replace: false,
            });
          }}
          onRemind={({ channel, event, startMs }) => {
            const eventId = event?.event_id ?? event?.eventId ?? event?.id ?? null;
            const id = String(eventId ?? '');
            if (!id) return;
            if (hasReminder(id)) {
              removeReminder(id);
              return;
            }
            addReminder({
              id,
              eventId,
              title: event?.languages?.[0]?.title || event?.title || event?.name || '',
              startMs: Number(startMs ?? event?.startDate?.valueOf?.() ?? new Date(event?.start).getTime()),
              channelStableId: getChannelStableId(channel),
            });
          }}
        />
      )}
    </div>
  );
}

export default EpgCards;

