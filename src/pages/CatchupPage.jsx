import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../contexts/PreloadContext';
import { usePlayer } from '../contexts/PlayerContext';
import panaccessService from '../services/panaccessService';
import { useSpatialNavigation } from '../hooks/navigation/useSpatialNavigation';
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
  focusKey,
  disabled,
  onEnter,
  title,
  timeText,
  imageUrl,
}) {
  const { ref, focused } = useSpatialNavigation({
    focusKey,
    isFocusable: !disabled,
    onEnterPress: disabled ? undefined : onEnter,
  });

  return (
    <button
      ref={ref}
      className={`catchup-event-card ${focused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
      type="button"
      disabled={disabled}
      tabIndex={-1}
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

function LegacyCatchupLayout({ groups, onPlayCatchup }) {
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
                  focusKey={`catchup-legacy-${String(group.catchupGroupId ?? group.id ?? '')}-${String(catchupId ?? timeText)}`}
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
      {flat.length === 0 ? <div className="catchup-empty">Sin catchup disponible</div> : null}
    </div>
  );
}

function TimelineCatchupLayout({ events, onPlayCatchup }) {
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
                  focusKey={`catchup-timeline-${block.label}-${String(catchupId ?? timeText)}`}
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
      {(events || []).length === 0 ? <div className="catchup-empty">Sin catchup disponible</div> : null}
    </div>
  );
}

function NetflixCatchupLayout({ recorded, recommended, onPlayCatchup }) {
  const recommendedItems = recommended || [];
  return (
    <div className="catchup-layout catchup-layout--netflix">
      <section className="catchup-rail">
        <h2 className="catchup-rail-title">{'Grabados'}</h2>
        <div className="catchup-rail-grid">
          {(recorded || []).slice(0, 30).map((task) => {
            const catchupId = task?.catchupId ?? task?.catchup_id ?? null;
            const event = task?.event;
            const timeText = task?.startDate ? fmtHHmm(task.startDate) : '';
            return (
              <CatchupEventButton
                key={catchupId ?? task?.recordingTaskId ?? timeText}
                focusKey={`catchup-netflix-recorded-${String(catchupId ?? task?.recordingTaskId ?? '')}`}
                disabled={!catchupId}
                onEnter={() => onPlayCatchup(catchupId, event)}
                title={getEventTitle(event) || task?.catchupName || '—'}
                timeText={timeText}
                imageUrl={task?.image || getEventImage(event)}
              />
            );
          })}
          {(recorded || []).length === 0 ? <div className="catchup-empty">No hay grabaciones</div> : null}
        </div>
      </section>

      <section className="catchup-rail">
        <h2 className="catchup-rail-title">{'Recomendados'}</h2>
        <div className="catchup-rail-grid">
          {recommendedItems.slice(0, 30).map((event) => {
            const catchupId = event?.catchupId ?? event?.id ?? event?.eventId ?? null;
            const startMs = getEventStartMs(event);
            const timeText = startMs ? fmtHHmm(startMs) : '';
            return (
              <CatchupEventButton
                key={catchupId ?? timeText}
                focusKey={`catchup-netflix-rec-${String(catchupId ?? timeText)}`}
                disabled={!catchupId}
                onEnter={() => onPlayCatchup(catchupId, event)}
                title={getEventTitle(event)}
                timeText={timeText}
                imageUrl={getEventImage(event)}
              />
            );
          })}
          {recommendedItems.length === 0 ? <div className="catchup-empty">Sin recomendaciones</div> : null}
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
  const { play, containerRef, state: playerState } = usePlayer();

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
    play({ type: 'catchup', id: catchupId, url, item: event || { catchupId }, autoPlay: true });
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
    play({ type: 'catchup', id: catchupId, url, item: { catchupId }, autoPlay: true });
  }, [location.state, enabled, play]);

  const layoutsToShow = useMemo(() => {
    if (showAllLayouts) return ['legacy', 'timeline', 'netflix'];
    return [activeLayout];
  }, [activeLayout, showAllLayouts]);

  return (
    <div className="catchup-page">
      <div className="catchup-overlay" />

      <div
        className={`catchup-player-video${playerState?.url ? ' catchup-player-video--active' : ''}`}
        ref={containerRef}
      >
        {playerState?.url && playerState?.isLoading && (
          <div className="catchup-player-loading">
            <div className="catchup-player-loading-spinner" />
          </div>
        )}
      </div>

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
                return <LegacyCatchupLayout key="legacy" groups={groups} onPlayCatchup={onPlayCatchup} />;
              }
              if (layoutKey === 'timeline') {
                return <TimelineCatchupLayout key="timeline" events={allEvents} onPlayCatchup={onPlayCatchup} />;
              }
              return <NetflixCatchupLayout key="netflix" recorded={recorded} recommended={recommended} onPlayCatchup={onPlayCatchup} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CatchupPage;

