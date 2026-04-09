import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';
import { usePlayer } from '../contexts/PlayerContext';
import { useParentalGate } from '../hooks/useParentalGate';
import panaccessService from '../services/panaccessService';
import '../styles/pages/_catchup.scss';

function fmtHHmm(ms) {
  if (ms == null) return '';
  const d = ms instanceof Date ? ms : new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtDateLabel(dateLike) {
  if (!dateLike) return '';
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getEventTitle(event) {
  return event?.languages?.[0]?.title || event?.title || event?.name || '';
}

function getEventImage(event) {
  return (
    event?.imageUrl ||
    event?.imageUrl2 ||
    event?.catchupImageUrl ||
    event?.posterUrl ||
    event?.image ||
    event?.poster ||
    null
  );
}

function getEventStartMs(event) {
  const v = event?.startDate ?? event?.start;
  if (v == null) return null;
  if (typeof v?.valueOf === 'function') {
    const ms = v.valueOf();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function CatchupEventButton({
  disabled,
  onEnter,
  title,
  timeText,
  imageUrl,
}) {
  return (
    <button
      className={`catchup-event-card ${disabled ? 'disabled' : ''}`}
      type="button"
      disabled={disabled}
      tabIndex={0}
      onClick={() => {
        if (disabled) return;
        onEnter?.();
      }}
    >
      {imageUrl ? <img className="catchup-event-card-img" src={imageUrl} alt="" /> : <div className="catchup-event-card-img--placeholder" />}
      <div className="catchup-event-card-body">
        <div className="catchup-event-card-title">{title || '—'}</div>
        {timeText ? <div className="catchup-event-card-time">{timeText}</div> : null}
      </div>
    </button>
  );
}

function LegacyCatchupLayout({ groups, onPlayCatchup, t }) {
  const flat = groups?.flatMap((g) => (g?.events || []).map((ev) => ({ group: g, event: ev }))) || [];
  return (
    <div className="catchup-layout catchup-layout--legacy">
      {groups?.map((group) => (
        <section key={group.catchupGroupId ?? group.id ?? group.epgStreamId} className="catchup-group">
          <h2 className="catchup-group-title">{group.name || group.catchupGroupId || `Grupo ${group.lcn ?? ''}`}</h2>
          <div className="catchup-events-grid">
            {(group.events || []).map((event) => {
              const catchupId = event?.catchupId ?? event?.id ?? event?.eventId ?? null;
              const startMs = getEventStartMs(event);
              const timeText = startMs ? fmtHHmm(startMs) : '';
              const imageUrl = getEventImage(event);
              return (
                <CatchupEventButton
                  key={catchupId ?? timeText}
                  disabled={!catchupId}
                  onEnter={() => onPlayCatchup(catchupId, event)}
                  title={getEventTitle(event)}
                  timeText={timeText}
                  imageUrl={imageUrl}
                />
              );
            })}
          </div>
        </section>
      ))}
      {flat.length === 0 ? <div className="catchup-empty">{t('catchup.empty', { defaultValue: 'Sin catchup disponible' })}</div> : null}
    </div>
  );
}

function TimelineCatchupLayout({ events, onPlayCatchup, t }) {
  const groupedByDate = useMemo(() => {
    const map = new Map();
    (events || []).forEach((ev) => {
      const startMs = getEventStartMs(ev);
      const label = fmtDateLabel(startMs);
      if (!label) return;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(ev);
    });
    const sortedLabels = Array.from(map.keys()).sort();
    return sortedLabels.map((label) => ({ label, items: map.get(label) || [] }));
  }, [events]);

  return (
    <div className="catchup-layout catchup-layout--timeline">
      {groupedByDate.map((block) => (
        <section key={block.label} className="catchup-timeline-block">
          <h2 className="catchup-timeline-date">{block.label}</h2>
          <div className="catchup-events-column">
            {block.items.map((event) => {
              const catchupId = event?.catchupId ?? event?.id ?? event?.eventId ?? null;
              const startMs = getEventStartMs(event);
              const timeText = startMs ? fmtHHmm(startMs) : '';
              return (
                <CatchupEventButton
                  key={catchupId ?? `${block.label}-${timeText}`}
                  disabled={!catchupId}
                  onEnter={() => onPlayCatchup(catchupId, event)}
                  title={getEventTitle(event)}
                  timeText={timeText}
                  imageUrl={getEventImage(event)}
                />
              );
            })}
          </div>
        </section>
      ))}
      {(events || []).length === 0 ? <div className="catchup-empty">{t('catchup.empty', { defaultValue: 'Sin catchup disponible' })}</div> : null}
    </div>
  );
}

function NetflixCatchupLayout({ recorded, recommended, onPlayCatchup, t }) {
  const recommendedItems = recommended || [];
  return (
    <div className="catchup-layout catchup-layout--netflix">
      <section className="catchup-rail">
        <h2 className="catchup-rail-title">{t('catchup.recorded', { defaultValue: 'Grabados' })}</h2>
        <div className="catchup-rail-grid">
          {(recorded || []).slice(0, 30).map((task) => {
            const catchupId = task?.catchupId ?? task?.catchup_id ?? null;
            const event = task?.event;
            const timeText = task?.startDate ? fmtHHmm(task.startDate) : '';
            return (
              <CatchupEventButton
                key={catchupId ?? task?.recordingTaskId ?? timeText}
                disabled={!catchupId}
                onEnter={() => onPlayCatchup(catchupId, event)}
                title={getEventTitle(event) || task?.catchupName || '—'}
                timeText={timeText}
                imageUrl={task?.image || getEventImage(event)}
              />
            );
          })}
          {(recorded || []).length === 0 ? <div className="catchup-empty">{t('catchup.noRecordings', { defaultValue: 'No hay grabaciones' })}</div> : null}
        </div>
      </section>

      <section className="catchup-rail">
        <h2 className="catchup-rail-title">{t('catchup.recommended', { defaultValue: 'Recomendados' })}</h2>
        <div className="catchup-rail-grid">
          {recommendedItems.slice(0, 30).map((event) => {
            const catchupId = event?.catchupId ?? event?.id ?? event?.eventId ?? null;
            const startMs = getEventStartMs(event);
            const timeText = startMs ? fmtHHmm(startMs) : '';
            return (
              <CatchupEventButton
                key={catchupId ?? timeText}
                disabled={!catchupId}
                onEnter={() => onPlayCatchup(catchupId, event)}
                title={getEventTitle(event)}
                timeText={timeText}
                imageUrl={getEventImage(event)}
              />
            );
          })}
          {recommendedItems.length === 0 ? <div className="catchup-empty">{t('catchup.noRecommendations', { defaultValue: 'Sin recomendaciones' })}</div> : null}
        </div>
      </section>
    </div>
  );
}

export function CatchupPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentBrand } = useBrand();
  const { catchup, loadCatchup } = usePreload();
  const { play } = usePlayer();
  const { requestPlayMedia } = useParentalGate();

  const catchupCfg = currentBrand?.catchup || {};
  const uiCfg = catchupCfg.ui || {};
  const enabled = catchupCfg.enabled !== false;
  const activeLayout = uiCfg.activeLayout || 'legacy';
  const showAllLayouts = !!uiCfg.showAllLayouts;

  const autoPlayDoneRef = useRef(false);

  useEffect(() => {
    if (!currentBrand) return;
    if (!enabled) return;
    if (catchup.status === 'idle') {
      loadCatchup(currentBrand);
    }
  }, [currentBrand, enabled, catchup.status, loadCatchup]);

  const groups = catchup.groups || [];
  const recorded = catchup.recorded || [];

  const allEvents = useMemo(() => {
    return groups.flatMap((g) => g?.events || []);
  }, [groups]);

  const recommended = useMemo(() => {
    // Recomendados simple: eventos más recientes (por startDate).
    const list = [...allEvents].filter(Boolean);
    list.sort((a, b) => {
      const aa = getEventStartMs(a) ?? 0;
      const bb = getEventStartMs(b) ?? 0;
      return bb - aa;
    });
    return list;
  }, [allEvents]);

  const resolveCatchupUrl = (catchupId) => {
    if (!catchupId) return null;
    try {
      const url = panaccessService.getCatchupM3u8Url({ catchupId });
      return url || null;
    } catch {
      return null;
    }
  };

  const onPlayCatchup = (catchupId, event) => {
    const url = resolveCatchupUrl(catchupId);
    if (!url) return;
    requestPlayMedia({
      item: event || { catchupId },
      ratingRaw: event?.parentalRating,
      title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
      message: t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
      playFn: () => play({ type: 'catchup', id: catchupId, url, item: event || { catchupId }, autoPlay: true }),
    });
  };

  useEffect(() => {
    const state = location.state || {};
    const catchupId = state.catchupId ?? state.catchup_id ?? null;
    if (!catchupId) return;
    if (!enabled) return;
    if (autoPlayDoneRef.current) return;

    const url = resolveCatchupUrl(catchupId);
    if (!url) return;

    autoPlayDoneRef.current = true;
    requestPlayMedia({
      item: { catchupId },
      ratingRaw: null,
      title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
      message: t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
      playFn: () => play({ type: 'catchup', id: catchupId, url, item: { catchupId }, autoPlay: true }),
    });
  }, [location.state, enabled, play]);

  const layoutsToShow = useMemo(() => {
    if (showAllLayouts) return ['legacy', 'timeline', 'netflix'];
    return [activeLayout];
  }, [activeLayout, showAllLayouts]);

  return (
    <div className="catchup-page">
      <div className="catchup-overlay" />

      <div className="catchup-content">
        <header className="catchup-header">
          <h1 className="catchup-title">{t('catchup.title', { defaultValue: 'Catchup' })}</h1>
          {catchup.status === 'loading' ? <div className="catchup-subtitle">{t('catchup.loading', { defaultValue: 'Cargando...' })}</div> : null}
        </header>

        {catchup.status === 'error' && (
          <div className="catchup-error">
            <p>{catchup.error || t('catchup.errorLoad', { defaultValue: 'Error al cargar catchup' })}</p>
            <button type="button" className="catchup-error-refresh" onClick={() => window.location.reload()}>
              {t('common.refreshPage', { defaultValue: 'Refrescar página' })}
            </button>
          </div>
        )}

        {catchup.status !== 'error' && (
          <div className="catchup-layouts">
            {layoutsToShow.map((layoutKey) => {
              if (catchupCfg.layouts?.[layoutKey]?.enabled === false) return null;

              if (layoutKey === 'legacy') {
                return <LegacyCatchupLayout key="legacy" groups={groups} onPlayCatchup={onPlayCatchup} t={t} />;
              }
              if (layoutKey === 'timeline') {
                return <TimelineCatchupLayout key="timeline" events={allEvents} onPlayCatchup={onPlayCatchup} t={t} />;
              }
              return <NetflixCatchupLayout key="netflix" recorded={recorded} recommended={recommended} onPlayCatchup={onPlayCatchup} t={t} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CatchupPage;

