import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { usePlayer } from '../contexts/PlayerContext';
import { usePreload } from '../store/usePreload';
import panaccessService from '../services/panaccessService';
import { getSearchDebounceMs, searchAll } from '../services/searchService';
import { useParentalGate } from '../hooks/useParentalGate';
import { useSearchPageTvNav } from '../hooks/useSearchPageTvNav';
import { FocusableInput } from '../components/navigation/FocusableInput';
import { buildSearchResultKey, useSearchSessionStore } from '../store/searchSessionStore';
import EpgEventModal from '../components/epg/EpgEventModal';
import VodDetailModal from '../components/vod/VodDetailModal';
import VodDetailModalClassic from '../components/vod/VodDetailModalClassic';
import { useBrandPlaceholderUrl } from '../hooks/useBrandPlaceholderUrl';
import { catchupGroupToChannel, catchupEventToChannel } from '../utils/catchupEvent';
import '../styles/pages/_search.scss';

function SearchTab({ id, label, active, hidden, onSelect }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      id={`search-tab-${id}`}
      className={`search-tab${active ? ' active' : ''}`}
      onClick={() => onSelect?.(id)}
    >
      {label}
    </button>
  );
}

function ResultItem({ item, onSelect }) {
  const { t } = useTranslation();
  const placeholderUrl = useBrandPlaceholderUrl();
  const resultKey = buildSearchResultKey(item);

  const [imgSrc, setImgSrc] = useState(item.logo || '');
  useEffect(() => {
    setImgSrc(item.logo || '');
  }, [item.logo, item.vodPosterFallback, item.type]);

  const timeText = (() => {
    if (item.type !== 'epg') return '';
    const startMs = item?.startMs ?? (item?.raw?.event?.startDate?.valueOf?.() ?? new Date(item?.raw?.event?.start).getTime());
    const endMs = item?.endMs ?? (item?.raw?.event?.endDate?.valueOf?.() ?? new Date(item?.raw?.event?.end).getTime());
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '';
    const start = new Date(startMs);
    const end = new Date(endMs);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

    const date = start.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${date} ${hhmm(start)} - ${hhmm(end)}`;
  })();

  const isEpg = item.type === 'epg';

  return (
    <button
      type="button"
      className={`search-result${isEpg ? ' search-result--epg' : ''}`}
      data-search-result-key={resultKey || undefined}
      onClick={() => onSelect?.(item)}
    >
      {(imgSrc || placeholderUrl) ? (
        <img
          className={`search-result__img${isEpg ? ' search-result__img--epg' : ''}`}
          src={imgSrc || placeholderUrl}
          alt={item.name}
          onError={() => {
            if (item.type === 'epg' && item.channelLogo && imgSrc !== item.channelLogo) {
              setImgSrc(item.channelLogo);
              return;
            }
            if (item.type === 'vod' && item.vodPosterFallback && imgSrc !== item.vodPosterFallback) {
              setImgSrc(item.vodPosterFallback);
              return;
            }
            if (placeholderUrl && imgSrc !== placeholderUrl) {
              setImgSrc(placeholderUrl);
              return;
            }
            setImgSrc('');
          }}
        />
      ) : (
        <div className={`search-result__img--placeholder${isEpg ? ' search-result__img--epg' : ''}`} />
      )}
      {isEpg ? (
        <>
          {(item.lcn != null || (item.channelName && String(item.channelName).trim())) ? (
            <div className="search-result__channel">
              {item.lcn != null ? <span className="search-result__lcn">{item.lcn}</span> : null}
              {item.channelName ? <span className="search-result__channel-name">{item.channelName}</span> : null}
            </div>
          ) : null}
          <div className="search-result__event-title">{item.name}</div>
          {timeText ? <div className="search-result__time">{timeText}</div> : null}
        </>
      ) : (
        <>
          <div className="search-result__name">
            {item.type === 'service' && item.lcn != null
              ? <span className="search-result__lcn">{item.lcn}</span>
              : null
            }
            {item.name}
          </div>
          {item.type === 'vod' && item.vodSearchMeta ? (
            <div className="search-result__vod-meta">
              {item.vodSearchMeta.kind === 'actor'
                ? t('search.vodMetaActor', { name: item.vodSearchMeta.value, defaultValue: `Actor: ${item.vodSearchMeta.value}` })
                : item.vodSearchMeta.kind === 'director'
                  ? t('search.vodMetaDirector', { name: item.vodSearchMeta.value, defaultValue: `Dirección: ${item.vodSearchMeta.value}` })
                  : t('search.vodMetaYear', { year: item.vodSearchMeta.value, defaultValue: `Año: ${item.vodSearchMeta.value}` })}
            </div>
          ) : null}
        </>
      )}
    </button>
  );
}

function SearchSection({ title, items, baseIndex, onSelect }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="search-section">
      <div className="search-section__title">{title}</div>
      <div className="search-list">
        {items.map((r, i) => (
          <ResultItem
            key={`${r.type}-${r.id ?? r.name ?? i}`}
            item={r}
            index={baseIndex + i}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export function SearchPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { isTV } = useDevice();
  const { currentBrand } = useBrand();
  const { play } = usePlayer();
  const { requestPlayChannel, requestPlayMedia } = useParentalGate();
  const { epg, vod, catchup, loadVOD, loadCatchup } = usePreload();

  const query = useSearchSessionStore((s) => s.query);
  const activeTab = useSearchSessionStore((s) => s.activeTab);
  const setSessionQuery = useSearchSessionStore((s) => s.setQuery);
  const setSessionActiveTab = useSearchSessionStore((s) => s.setActiveTab);
  const bindBrand = useSearchSessionStore((s) => s.bindBrand);
  const touchCatalogSnapshot = useSearchSessionStore((s) => s.touchCatalogSnapshot);

  const [debouncedQuery, setDebouncedQuery] = useState(() => useSearchSessionStore.getState().query);
  const [selectedEpgItem, setSelectedEpgItem] = useState(null);
  const [selectedVodItem, setSelectedVodItem] = useState(null);
  const [selectedCatchupDetail, setSelectedCatchupDetail] = useState(null);
  const inputRef = useRef(null);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  const searchModalOpen = Boolean(selectedEpgItem || selectedVodItem || selectedCatchupDetail);

  useEffect(() => {
    if (location.pathname !== '/home/buscador') return;
    const store = useSearchSessionStore.getState();
    if (store.isExpired()) {
      store.reset();
      setDebouncedQuery('');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!currentBrand?.brand) return;
    bindBrand(currentBrand.brand);
  }, [currentBrand?.brand, bindBrand]);

  useEffect(() => {
    touchCatalogSnapshot({
      epgLastLoadedAt: epg.lastLoadedAt ?? null,
      vodLastLoadedAt: vod.lastLoadedAt ?? null,
      catchupLastLoadedAt: catchup.lastLoadedAt ?? null,
    });
  }, [epg.lastLoadedAt, vod.lastLoadedAt, catchup.lastLoadedAt, touchCatalogSnapshot]);

  useEffect(() => {
    if (query === debouncedQuery) return undefined;
    const id = setTimeout(() => setDebouncedQuery(query), getSearchDebounceMs());
    return () => clearTimeout(id);
  }, [query, debouncedQuery]);

  // PC: foco en input al entrar. TV: foco sin abrir IME (Opción B — useSearchPageTvNav).
  useEffect(() => {
    if (isTV) return undefined;
    const el = inputRef.current;
    if (!el) return undefined;
    try {
      el.focus();
    } catch {
      /* noop */
    }
    return undefined;
  }, [isTV]);

  // Cargar VOD/Catchup al entrar al buscador.
  // tRef.current se pasa como snapshot al momento de la carga para evitar
  // que el cambio de referencia de `t` re-dispare este efecto innecesariamente.
  useEffect(() => {
    if (!currentBrand) return;
    if (vod.status === 'idle') loadVOD(currentBrand, { t: tRef.current });
    if (catchup.status === 'idle') loadCatchup(currentBrand);
  }, [currentBrand, vod.status, catchup.status, loadVOD, loadCatchup]);

  const resultsAll = useMemo(() => {
    return searchAll({
      query: debouncedQuery,
      services: epg.streams || [],
      vods: vod.allVods || [],
      catchupGroups: catchup.groups || [],
      vodDrmBaseUrl: currentBrand?.drm ?? '',
    });
  }, [debouncedQuery, epg.streams, vod.allVods, catchup.groups, currentBrand?.drm]);

  const grouped = useMemo(() => {
    const services = [];
    const vods = [];
    const catchups = [];
    const epgEvents = [];
    resultsAll.forEach((r) => {
      if (r.type === 'service') services.push(r);
      else if (r.type === 'vod') vods.push(r);
      else if (r.type === 'catchup') catchups.push(r);
      else if (r.type === 'epg') epgEvents.push(r);
    });
    return { services, vods, catchups, epgEvents };
  }, [resultsAll]);

  const isEmptyQuery = !debouncedQuery || debouncedQuery.trim().length === 0;
  const hideServiceTab = isEmptyQuery || grouped.services.length === 0;
  const hideVodTab = isEmptyQuery || grouped.vods.length === 0;
  const hideCatchupTab = isEmptyQuery || grouped.catchups.length === 0;
  const hideEpgTab = isEmptyQuery || grouped.epgEvents.length === 0;
  const totalCategories = [grouped.services, grouped.vods, grouped.catchups, grouped.epgEvents].filter(a => a.length > 0).length;
  const hideAllTab = isEmptyQuery || totalCategories === 0;

  const effectiveTab = useMemo(() => {
    if (activeTab === 'all' && hideAllTab) return 'all';
    if (activeTab === 'service' && hideServiceTab) return 'all';
    if (activeTab === 'vod' && hideVodTab) return 'all';
    if (activeTab === 'catchup' && hideCatchupTab) return 'all';
    if (activeTab === 'epg' && hideEpgTab) return 'all';
    return activeTab;
  }, [activeTab, hideAllTab, hideServiceTab, hideVodTab, hideCatchupTab, hideEpgTab]);

  const visibleCount = useMemo(() => {
    if (effectiveTab === 'all') return grouped.services.length + grouped.vods.length + grouped.catchups.length + grouped.epgEvents.length;
    if (effectiveTab === 'service') return grouped.services.length;
    if (effectiveTab === 'vod') return grouped.vods.length;
    if (effectiveTab === 'catchup') return grouped.catchups.length;
    if (effectiveTab === 'epg') return grouped.epgEvents.length;
    return 0;
  }, [effectiveTab, grouped]);

  useSearchPageTvNav({
    modalOpen: searchModalOpen,
    restoreSignal: debouncedQuery,
    resultCount: visibleCount,
  });

  const findCatchupGroupForEvent = useCallback((event, groups) => {
    if (!event) return null;
    const list = Array.isArray(groups) ? groups : [];
    const gid = event.catchupGroupId ?? event.catchup_group_id;
    if (gid != null && gid !== '') {
      const match = list.find(
        (g) =>
          String(g?.catchupGroupId ?? g?.catchup_group_id ?? '') === String(gid) ||
          String(g?.epgStreamId ?? g?.epg_stream_id ?? '') === String(gid),
      );
      if (match) return match;
    }
    const epgId = event.epgStreamId ?? event.epg_stream_id;
    if (epgId != null && epgId !== '') {
      return (
        list.find((g) => String(g?.epgStreamId ?? g?.epg_stream_id ?? '') === String(epgId)) ?? null
      );
    }
    return null;
  }, []);

  const handleSelect = (item) => {
    if (!item) return;

    if (item.type === 'vod') {
      setSelectedVodItem(item.raw || item);
      return;
    }

    if (item.type === 'catchup') {
      const event = item.raw || item;
      const group = findCatchupGroupForEvent(event, catchup.groups);
      setSelectedCatchupDetail({
        event,
        channel: catchupGroupToChannel(group) || catchupEventToChannel(event),
      });
      return;
    }

    if (item.type === 'service') {
      const channel = item.raw;
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
          try {
            url = panaccessService.getStreamM3u8Url({ streamId });
          } catch {
            // noop
          }
        }
      }

      if (!url) return;
      try {
        url = panaccessService.normalizePlaybackUrl(url);
      } catch {
        // noop
      }
      if (!url) return;
      requestPlayChannel({
        channel,
        playFn: () =>
          play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true }),
      });
    }

    if (item.type === 'epg') {
      setSelectedEpgItem(item);
    }
  };

  const handleEpgModalClose = useCallback(() => {
    setSelectedEpgItem(null);
  }, []);

  const handleCatchupModalClose = useCallback(() => {
    setSelectedCatchupDetail(null);
  }, []);

  const handleCatchupWatch = useCallback(
    (_catchupLookupId, event) => {
      const ev = event ?? selectedCatchupDetail?.event;
      const streamId = ev?.id ?? ev?.catchupId ?? _catchupLookupId;
      if (streamId == null) return;
      setSelectedCatchupDetail(null);
      try {
        const url = panaccessService.normalizePlaybackUrl(
          panaccessService.getCatchupM3u8Url({ catchupId: streamId }),
        );
        if (url) {
          requestPlayMedia({
            item: ev || { catchupId: streamId, id: streamId },
            ratingRaw: ev?.parentalRating ?? null,
            title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
            message: t('parental.restrictedMessage', {
              defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.',
            }),
            playFn: () =>
              play({
                type: 'catchup',
                id: streamId,
                url,
                item: ev || { catchupId: streamId, id: streamId },
                autoPlay: true,
              }),
          });
        }
      } catch {
        // noop
      }
    },
    [selectedCatchupDetail, play, requestPlayMedia, t],
  );

  const handleEpgPlayLive = useCallback(() => {
    if (!selectedEpgItem) return;
    const channel = selectedEpgItem?.raw?.channel;
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
        try {
          url = panaccessService.getStreamM3u8Url({ streamId });
        } catch {
          // noop
        }
      }
    }

    if (!url) return;
    try {
      url = panaccessService.normalizePlaybackUrl(url);
    } catch {
      // noop
    }
    if (!url) return;

    setSelectedEpgItem(null);
    requestPlayChannel({
      channel,
      playFn: () =>
        play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true }),
    });
  }, [selectedEpgItem, play, requestPlayChannel]);

  const handleEpgWatchCatchup = useCallback(
    (catchupLookupId) => {
      if (catchupLookupId == null) return;
      const ev = selectedEpgItem?.raw?.event ?? selectedEpgItem?.event;
      const streamId = ev?.id ?? ev?.catchupId ?? catchupLookupId;
      if (streamId == null) return;
      setSelectedEpgItem(null);
      try {
        const url = panaccessService.normalizePlaybackUrl(
          panaccessService.getCatchupM3u8Url({ catchupId: streamId }),
        );
        if (url) {
          requestPlayMedia({
            item: ev || { catchupId: streamId, id: streamId },
            ratingRaw: selectedEpgItem?.raw?.event?.parentalRating ?? null,
            title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
            message: t('parental.restrictedMessage', {
              defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.',
            }),
            playFn: () =>
              play({
                type: 'catchup',
                id: streamId,
                url,
                item: ev || { catchupId: streamId, id: streamId },
                autoPlay: true,
              }),
          });
        }
      } catch {
        // noop
      }
    },
    [selectedEpgItem, play, requestPlayMedia, t],
  );

  const vodLayout = currentBrand?.vod?.layout === 'classic' ? 'classic' : 'hero';
  const vodCategories = vod.categories || [];

  const handleVodPlay = useCallback((params) => {
    if (!params?.url) return;
    setSelectedVodItem(null);
    requestPlayMedia({
      item: params.item,
      ratingRaw: params?.item?.parentalRating,
      title: t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
      message: t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
      playFn: () => play(params),
    });
  }, [play, requestPlayMedia, t]);

  const epgModalIsLive = useMemo(() => {
    if (!selectedEpgItem) return false;
    const now = Date.now();
    const startMs = selectedEpgItem.startMs;
    const endMs = selectedEpgItem.endMs;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
    return now >= startMs && now <= endMs;
  }, [selectedEpgItem]);

  return (
    <div className="search-page">
      <div className="search-overlay" />
      <div className="search-container">
        <div className="search-header">
          <FocusableInput
            ref={inputRef}
            id="search-input-tv"
            className="search-input"
            value={query}
            placeholder={t('search.placeholder', { defaultValue: 'Buscar...' })}
            onChange={(e) => setSessionQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSessionQuery('');
              }
              if (!isTV && e.key === 'Enter') {
                const all = resultsAll || [];
                if (all.length > 0) handleSelect(all[0]);
              }
            }}
            autoComplete="off"
          />
          <button
            type="button"
            id="search-clear-btn"
            className="search-clear"
            tabIndex={0}
            onClick={() => setSessionQuery('')}
          >
            {t('search.clear', { defaultValue: 'Limpiar' })}
          </button>
        </div>

        {!hideAllTab && (
          <div className="search-tabs" role="tablist" aria-label={t('search.tabs', { defaultValue: 'Tabs de búsqueda' })}>
            <SearchTab id="all" label={t('search.tabAll', { defaultValue: 'Todos' })} active={activeTab === 'all'} hidden={totalCategories < 2} onSelect={setSessionActiveTab} />
            <SearchTab id="service" label={t('search.tabServices', { defaultValue: 'Servicios' })} active={activeTab === 'service'} hidden={hideServiceTab} onSelect={setSessionActiveTab} />
            <SearchTab id="epg" label={t('search.tabEpg', { defaultValue: 'EPG' })} active={activeTab === 'epg'} hidden={hideEpgTab} onSelect={setSessionActiveTab} />
            <SearchTab id="vod" label={t('search.tabVod', { defaultValue: 'VOD' })} active={activeTab === 'vod'} hidden={hideVodTab} onSelect={setSessionActiveTab} />
            <SearchTab id="catchup" label={t('search.tabCatchup', { defaultValue: 'Catchup' })} active={activeTab === 'catchup'} hidden={hideCatchupTab} onSelect={setSessionActiveTab} />
          </div>
        )}

        <div className="search-results">
          {isEmptyQuery ? (
            <div className="search-empty">{t('search.typeToSearch', { defaultValue: 'Escribe para buscar' })}</div>
          ) : visibleCount === 0 ? (
            <div className="search-empty">{t('search.noResults', { defaultValue: 'No se encontraron resultados.' })}</div>
          ) : (
            <>
              <div className="search-count">
                {visibleCount} {visibleCount === 1 ? t('search.result', { defaultValue: 'resultado' }) : t('search.results', { defaultValue: 'resultados' })}
              </div>

              {effectiveTab === 'all' ? (
                <>
                  <SearchSection
                    title={t('search.sectionServices', { defaultValue: 'Servicios' })}
                    items={grouped.services}
                    baseIndex={0}
                    onSelect={handleSelect}
                  />
                  <SearchSection
                    title={t('search.sectionVod', { defaultValue: 'VOD' })}
                    items={grouped.vods}
                    baseIndex={grouped.services.length}
                    onSelect={handleSelect}
                  />
                  <SearchSection
                    title={t('search.sectionCatchup', { defaultValue: 'Catchup' })}
                    items={grouped.catchups}
                    baseIndex={grouped.services.length + grouped.vods.length}
                    onSelect={handleSelect}
                  />
                  <SearchSection
                    title={t('search.sectionEpg', { defaultValue: 'EPG' })}
                    items={grouped.epgEvents}
                    baseIndex={grouped.services.length + grouped.vods.length + grouped.catchups.length}
                    onSelect={handleSelect}
                  />
                </>
              ) : (
                <div className="search-list">
                  {(effectiveTab === 'service' ? grouped.services
                    : effectiveTab === 'vod' ? grouped.vods
                    : effectiveTab === 'catchup' ? grouped.catchups
                    : grouped.epgEvents
                  ).map((r, i) => (
                    <ResultItem
                      key={`${r.type}-${r.id ?? r.name ?? i}`}
                      item={r}
                      index={i}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <EpgEventModal
        open={!!selectedEpgItem}
        channel={selectedEpgItem?.raw?.channel ?? null}
        event={selectedEpgItem?.raw?.event ?? null}
        isLive={epgModalIsLive}
        nowMs={Date.now()}
        canPlayLive={true}
        showActions={true}
        onClose={handleEpgModalClose}
        onPlayLive={handleEpgPlayLive}
        onWatchCatchup={handleEpgWatchCatchup}
      />

      <EpgEventModal
        open={!!selectedCatchupDetail}
        channel={selectedCatchupDetail?.channel ?? null}
        event={selectedCatchupDetail?.event ?? null}
        isLive={false}
        nowMs={Date.now()}
        canPlayLive={false}
        showActions
        detailContext="catchup"
        onClose={handleCatchupModalClose}
        onWatchCatchup={handleCatchupWatch}
      />

      {selectedVodItem && vodLayout === 'classic' && (
        <VodDetailModalClassic
          item={selectedVodItem}
          categories={vodCategories}
          onClose={() => setSelectedVodItem(null)}
          onPlay={handleVodPlay}
        />
      )}
      {selectedVodItem && vodLayout === 'hero' && (
        <VodDetailModal
          item={selectedVodItem}
          categories={vodCategories}
          onClose={() => setSelectedVodItem(null)}
          onPlay={handleVodPlay}
        />
      )}
    </div>
  );
}

export default SearchPage;

