import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { usePlayer } from '../contexts/PlayerContext';
import { usePreload } from '../store/usePreload';
import panaccessService from '../services/panaccessService';
import { getSearchDebounceMs, searchAll } from '../services/searchService';
import { useSpatialNavigation } from '../hooks/navigation/useSpatialNavigation';
import '../styles/pages/_search.scss';

function SearchTab({ id, label, active, hidden, onSelect }) {
  const { ref } = useSpatialNavigation({
    focusKey: `search-tab-${id}`,
    onEnterPress: () => onSelect?.(id),
  });
  if (hidden) return null;
  return (
    <button
      ref={ref}
      type="button"
      className={`search-tab${active ? ' active' : ''}`}
      onClick={() => onSelect?.(id)}
    >
      {label}
    </button>
  );
}

function ResultItem({ item, index, onSelect }) {
  const { ref, isTV, focused } = useSpatialNavigation({
    focusKey: `search-result-${index}-${item.type}-${item.id ?? item.name ?? 'x'}`,
    onEnterPress: () => onSelect?.(item),
  });

  const [imgSrc, setImgSrc] = useState(item.logo || '');
  useEffect(() => {
    setImgSrc(item.logo || '');
  }, [item.logo, item.vodPosterFallback]);

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
      ref={ref}
      type="button"
      className={`search-result${isEpg ? ' search-result--epg' : ''}${focused ? ' focused' : ''}`}
      onClick={() => onSelect?.(item)}
      onMouseEnter={!isTV ? () => {} : undefined}
    >
      {imgSrc ? (
        <img
          className={`search-result__img${isEpg ? ' search-result__img--epg' : ''}`}
          src={imgSrc}
          alt={item.name}
          onError={() => {
            // Fallback: si la imagen del evento falla, mostrar la del canal
            if (item.type === 'epg' && item.channelLogo && imgSrc !== item.channelLogo) {
              setImgSrc(item.channelLogo);
              return;
            }
            // Series VOD: background → posterInfo si la URL principal falla
            if (item.type === 'vod' && item.vodPosterFallback && imgSrc !== item.vodPosterFallback) {
              setImgSrc(item.vodPosterFallback);
              return;
            }
            // Último recurso: placeholder
            if (imgSrc) setImgSrc('');
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
        <div className="search-result__name">
          {item.type === 'service' && item.lcn != null
            ? <span className="search-result__lcn">{item.lcn}</span>
            : null
          }
          {item.name}
        </div>
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
  const navigate = useNavigate();
  const { currentBrand } = useBrand();
  const { play } = usePlayer();
  const { epg, vod, catchup, loadVOD, loadCatchup } = usePreload();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all | service | vod | catchup | epg
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef(null);
  // Ref para que el efecto de carga siempre use la función t más reciente
  // sin añadirla como dependencia (evita re-disparos por cambio de referencia)
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), getSearchDebounceMs());
    return () => clearTimeout(id);
  }, [query]);

  // Best-effort: enfocar input al entrar y abrir teclado en TVs
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    try { el.focus(); } catch { /* noop */ }
    try {
      const len = (el.value || '').length;
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(len, len);
    } catch { /* noop */ }
    const timer = setTimeout(() => {
      try {
        el.focus();
        if (typeof el.click === 'function') el.click();
      } catch { /* noop */ }
    }, 60);
    return () => clearTimeout(timer);
  }, []);

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
  const hideVodTab = !isEmptyQuery && grouped.vods.length === 0;
  const hideCatchupTab = !isEmptyQuery && grouped.catchups.length === 0;
  const hideEpgTab = !isEmptyQuery && grouped.epgEvents.length === 0;
  const hasServices = (epg.streams?.length ?? 0) > 0;

  // Tab efectivo: si el tab activo queda sin resultados, hacer fallback a 'all'
  const effectiveTab = useMemo(() => {
    if (activeTab === 'vod' && hideVodTab) return 'all';
    if (activeTab === 'catchup' && hideCatchupTab) return 'all';
    if (activeTab === 'epg' && hideEpgTab) return 'all';
    return activeTab;
  }, [activeTab, hideVodTab, hideCatchupTab, hideEpgTab]);

  const visibleCount = useMemo(() => {
    if (effectiveTab === 'all') return grouped.services.length + grouped.vods.length + grouped.catchups.length + grouped.epgEvents.length;
    if (effectiveTab === 'service') return grouped.services.length;
    if (effectiveTab === 'vod') return grouped.vods.length;
    if (effectiveTab === 'catchup') return grouped.catchups.length;
    if (effectiveTab === 'epg') return grouped.epgEvents.length;
    return 0;
  }, [effectiveTab, grouped]);

  const handleSelect = (item) => {
    if (!item) return;

    if (item.type === 'vod') {
      navigate('/home/vod', { state: { adOpenVodId: item.id } });
      return;
    }

    if (item.type === 'catchup') {
      const catchupId = item.catchupId ?? item.id;
      if (!catchupId) return;
      try {
        const url = panaccessService.getCatchupM3u8Url({ catchupId });
        const normalized = panaccessService.normalizePlaybackUrl(url);
        if (normalized) {
          play({ type: 'catchup', id: catchupId, url: normalized, item: item.raw || { catchupId }, autoPlay: true });
        }
      } catch {
        // noop
      }
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
      play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true });
    }

    if (item.type === 'epg') {
      const channel = item?.raw?.channel;
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
      play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true });
    }
  };

  return (
    <div className="search-page">
      <div className="search-overlay" />
      <div className="search-container">
        <div className="search-header">
          <input
            ref={inputRef}
            id="searchInput"
            className="search-input"
            value={query}
            placeholder={t('search.placeholder', { defaultValue: 'Buscar...' })}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
              }
            }}
          />
          <button type="button" className="search-clear" onClick={() => setQuery('')}>
            {t('search.clear', { defaultValue: 'Limpiar' })}
          </button>
        </div>

        <div className="search-tabs" role="tablist" aria-label={t('search.tabs', { defaultValue: 'Tabs de búsqueda' })}>
          <SearchTab id="all" label={t('search.tabAll', { defaultValue: 'Todos' })} active={activeTab === 'all'} onSelect={setActiveTab} />
          <SearchTab id="service" label={t('search.tabServices', { defaultValue: 'Servicios' })} active={activeTab === 'service'} hidden={!hasServices} onSelect={setActiveTab} />
          <SearchTab id="epg" label={t('search.tabEpg', { defaultValue: 'EPG' })} active={activeTab === 'epg'} hidden={hideEpgTab} onSelect={setActiveTab} />
          <SearchTab id="vod" label="VOD" active={activeTab === 'vod'} hidden={hideVodTab} onSelect={setActiveTab} />
          <SearchTab id="catchup" label="Catchup" active={activeTab === 'catchup'} hidden={hideCatchupTab} onSelect={setActiveTab} />
        </div>

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
    </div>
  );
}

export default SearchPage;

