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
import { BrandFallbackImage } from '../components/common/BrandFallbackImage';
import { useTvInitialFocus } from '../hooks/useTvInitialFocus';
import {
  catchupGroupToChannel,
  findCatchupEventInGroups,
  fmtHHmm,
  getCatchupGroupKey,
  getCatchupRailItemKey,
  getCatchupId,
  getCatchupStreamId,
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
      <BrandFallbackImage
        src={imageUrl}
        alt=""
        className="catchup-event-card-img"
        placeholderClassName="catchup-event-card-img--placeholder"
      />
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
      {groups?.map((group, groupIndex) => (
        <section key={getCatchupGroupKey(group, groupIndex)} className="catchup-group">
          <h2 className="catchup-group-title">{group.name || group.catchupGroupId || `Grupo ${group.lcn ?? ''}`}</h2>
          <div className="catchup-events-grid">
            {(group.events || []).map((event, eventIndex) => {
              const catchupId = getCatchupId(event);
              const startMs = getEventStartMs(event);
              const timeText = startMs ? fmtHHmm(startMs) : '';
              const imageUrl = getEventImage(event);
              const groupKey = getCatchupGroupKey(group, groupIndex);
              return (
                <CatchupEventButton
                  key={getCatchupRailItemKey(event, groupKey, eventIndex)}
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

  // Cobertura nueva: esta página no tenía ninguna navegación por D-pad; el
  // motor de geometría genérico ya resuelve LRUD entre las tarjetas/rieles,
  // solo falta colocar el foco inicial al entrar.
  useTvInitialFocus('.catchup-content', [catchup.status, groups.length]);

  const resolveCatchupUrl = (streamCatchupId) => {
    if (streamCatchupId == null || streamCatchupId === '') return null;
    const id = streamCatchupId;
    try {
      const raw = panaccessService.getCatchupM3u8Url({ catchupId: id });
      return panaccessService.normalizePlaybackUrl(raw) || null;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[CatchupPage] resolveCatchupUrl failed', id, err);
      }
      return null;
    }
  };

  const playCatchup = (_catchupIdArg, event) => {
    const streamId = getCatchupStreamId(event);
    const url = resolveCatchupUrl(streamId);
    if (!url || streamId == null) {
      if (import.meta.env.DEV) {
        console.warn('[CatchupPage] No se pudo reproducir catchup', { streamId, event });
      }
      return;
    }
    requestPlayMedia({
      item: event || { catchupId: streamId, id: streamId },
      ratingRaw: event?.parentalRating,
      title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
      message: t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
      playFn: () =>
        play({
          type: 'catchup',
          id: streamId,
          url,
          item: event || { catchupId: streamId, id: streamId },
          autoPlay: true,
        }),
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
    const lookupId = state.catchupId ?? state.catchup_id ?? null;
    if (!lookupId) return;
    if (!enabled) return;
    if (autoPlayDoneRef.current) return;
    if (groups.length === 0) return;

    const event = findCatchupEventInGroups(groups, lookupId, state.epgStreamId);
    const streamId = getCatchupStreamId(event) ?? getCatchupStreamId({ id: lookupId });
    const url = resolveCatchupUrl(streamId);
    if (!url || streamId == null) return;

    autoPlayDoneRef.current = true;
    requestPlayMedia({
      item: event || { catchupId: streamId, id: streamId },
      ratingRaw: event?.parentalRating ?? null,
      title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
      message: t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
      playFn: () =>
        play({
          type: 'catchup',
          id: streamId,
          url,
          item: event || { catchupId: streamId, id: streamId },
          autoPlay: true,
        }),
    });
  }, [location.state, enabled, groups, play, requestPlayMedia, t]);

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
