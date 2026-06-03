import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';
import { usePlayer } from '../contexts/PlayerContext';
import { useParentalGate } from '../hooks/useParentalGate';
import panaccessService from '../services/panaccessService';
import EpgEventModal from '../components/epg/EpgEventModal';
import { ChannelsRailsCatchupLayout } from '../components/catchup/ChannelsRailsCatchupLayout';
import {
  catchupGroupToChannel,
  fmtHHmm,
  getCatchupId,
  getEventImage,
  getEventStartMs,
  getEventTitle,
} from '../utils/catchupEvent';
import '../styles/pages/_catchup.scss';

function CatchupEventButton({
  onEnter,
  title,
  timeText,
  imageUrl,
  unavailable,
}) {
  return (
    <button
      className={`catchup-event-card ${unavailable ? 'unavailable' : ''}`}
      type="button"
      tabIndex={0}
      onClick={() => onEnter?.()}
    >
      {imageUrl ? <img className="catchup-event-card-img" src={imageUrl} alt="" /> : <div className="catchup-event-card-img--placeholder" />}
      <div className="catchup-event-card-body">
        <div className="catchup-event-card-title">{title || '—'}</div>
        {timeText ? <div className="catchup-event-card-time">{timeText}</div> : null}
      </div>
    </button>
  );
}

function LegacyCatchupLayout({ groups, onSelectEvent, t }) {
  const flat = groups?.flatMap((g) => (g?.events || []).map((ev) => ({ group: g, event: ev }))) || [];
  return (
    <div className="catchup-layout catchup-layout--legacy">
      {groups?.map((group) => (
        <section key={group.catchupGroupId ?? group.id ?? group.epgStreamId} className="catchup-group">
          <h2 className="catchup-group-title">{group.name || group.catchupGroupId || `Grupo ${group.lcn ?? ''}`}</h2>
          <div className="catchup-events-grid">
            {(group.events || []).map((event) => {
              const catchupId = getCatchupId(event);
              const startMs = getEventStartMs(event);
              const timeText = startMs ? fmtHHmm(startMs) : '';
              const imageUrl = getEventImage(event);
              return (
                <CatchupEventButton
                  key={catchupId ?? timeText}
                  unavailable={!catchupId}
                  onEnter={() => onSelectEvent?.(event, group)}
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
  const activeLayout = uiCfg.activeLayout || 'rails';
  const showAllLayouts = !!uiCfg.showAllLayouts;

  const [detailSelection, setDetailSelection] = useState(null);
  const autoPlayDoneRef = useRef(false);

  useEffect(() => {
    if (!currentBrand) return;
    if (!enabled) return;
    if (catchup.status === 'idle') {
      loadCatchup(currentBrand);
    }
  }, [currentBrand, enabled, catchup.status, loadCatchup]);

  const groups = useMemo(() => catchup.groups || [], [catchup.groups]);

  const resolveCatchupUrl = (catchupId) => {
    if (!catchupId) return null;
    try {
      const url = panaccessService.getCatchupM3u8Url({ catchupId });
      return url || null;
    } catch {
      return null;
    }
  };

  const playCatchup = (catchupId, event) => {
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

  const onSelectEvent = (event, group) => {
    setDetailSelection({
      event,
      channel: catchupGroupToChannel(group),
    });
  };

  const onWatchFromDetail = (catchupId, event) => {
    setDetailSelection(null);
    playCatchup(catchupId, event);
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
  }, [location.state, enabled, play, requestPlayMedia, t]);

  const layoutsToShow = useMemo(() => {
    if (showAllLayouts) return ['rails', 'legacy'];
    return [activeLayout];
  }, [activeLayout, showAllLayouts]);

  const renderLayout = (layoutKey) => {
    if (catchupCfg.layouts?.[layoutKey]?.enabled === false) return null;

    if (layoutKey === 'rails') {
      return <ChannelsRailsCatchupLayout key="rails" groups={groups} onSelectEvent={onSelectEvent} t={t} />;
    }
    if (layoutKey === 'legacy') {
      return <LegacyCatchupLayout key="legacy" groups={groups} onSelectEvent={onSelectEvent} t={t} />;
    }
    return null;
  };

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
            {layoutsToShow.map((layoutKey) => renderLayout(layoutKey))}
          </div>
        )}
      </div>

      <EpgEventModal
        open={Boolean(detailSelection)}
        channel={detailSelection?.channel ?? null}
        event={detailSelection?.event ?? null}
        isLive={false}
        nowMs={Date.now()}
        canPlayLive={false}
        showActions
        detailContext="catchup"
        onClose={() => setDetailSelection(null)}
        onWatchCatchup={onWatchFromDetail}
      />
    </div>
  );
}

export default CatchupPage;
