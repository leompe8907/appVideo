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
    focusKey: `search-result-${index}-${item.type}-${item.id ?? 'x'}`,
    onEnterPress: () => onSelect?.(item),
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`search-result${focused ? ' focused' : ''}`}
      onClick={() => onSelect?.(item)}
      onMouseEnter={!isTV ? () => {} : undefined}
    >
      {item.logo ? <img className="search-result__img" src={item.logo} alt="" /> : <div className="search-result__img search-result__img--placeholder" />}
      <div className="search-result__meta">
        <div className="search-result__title">
          {item.type === 'service' && item.lcn != null ? <span className="search-result__lcn">{item.lcn}</span> : null}
          <span className="search-result__name">{item.name}</span>
        </div>
        <div className="search-result__type">{item.type}</div>
      </div>
    </button>
  );
}

export function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand } = useBrand();
  const { play } = usePlayer();
  const { epg, vod, catchup, loadVOD, loadCatchup } = usePreload();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all | service | vod | catchup
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef(null);

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

  // Cargar VOD/Catchup si el usuario los necesita en búsqueda
  useEffect(() => {
    if (!currentBrand) return;
    if (vod.status === 'idle') loadVOD(currentBrand, { t });
    if (catchup.status === 'idle') loadCatchup(currentBrand);
  }, [currentBrand, vod.status, catchup.status, loadVOD, loadCatchup, t]);

  const resultsAll = useMemo(() => {
    return searchAll({
      query: debouncedQuery,
      services: epg.streams || [],
      vods: vod.allVods || [],
      catchupGroups: catchup.groups || [],
    });
  }, [debouncedQuery, epg.streams, vod.allVods, catchup.groups]);

  const grouped = useMemo(() => {
    const services = [];
    const vods = [];
    const catchups = [];
    resultsAll.forEach((r) => {
      if (r.type === 'service') services.push(r);
      else if (r.type === 'vod') vods.push(r);
      else if (r.type === 'catchup') catchups.push(r);
    });
    return { services, vods, catchups };
  }, [resultsAll]);

  const isEmptyQuery = !debouncedQuery || debouncedQuery.trim().length === 0;
  const hideVodTab = !isEmptyQuery && grouped.vods.length === 0;
  const hideCatchupTab = !isEmptyQuery && grouped.catchups.length === 0;
  const hasServices = (epg.streams?.length ?? 0) > 0;

  const visibleResults = useMemo(() => {
    const tab = (() => {
      if (activeTab === 'vod' && hideVodTab) return 'all';
      if (activeTab === 'catchup' && hideCatchupTab) return 'all';
      return activeTab;
    })();
    if (tab === 'service') return grouped.services;
    if (tab === 'vod') return grouped.vods;
    if (tab === 'catchup') return grouped.catchups;
    return resultsAll;
  }, [activeTab, grouped, resultsAll, hideVodTab, hideCatchupTab]);

  // Nota: no forzamos setActiveTab en effects para evitar renders en cascada;
  // visibleResults usa un tab efectivo con fallback a 'all'.

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
          <SearchTab id="vod" label="VOD" active={activeTab === 'vod'} hidden={hideVodTab} onSelect={setActiveTab} />
          <SearchTab id="catchup" label="Catchup" active={activeTab === 'catchup'} hidden={hideCatchupTab} onSelect={setActiveTab} />
        </div>

        <div className="search-results">
          {isEmptyQuery ? (
            <div className="search-empty">{t('search.typeToSearch', { defaultValue: 'Escribe para buscar' })}</div>
          ) : visibleResults.length === 0 ? (
            <div className="search-empty">{t('search.noResults', { defaultValue: 'No se encontraron resultados.' })}</div>
          ) : (
            <>
              <div className="search-count">
                {visibleResults.length} {visibleResults.length === 1 ? t('search.result', { defaultValue: 'resultado' }) : t('search.results', { defaultValue: 'resultados' })}
              </div>
              <div className="search-list">
                {visibleResults.map((r, i) => (
                  <ResultItem key={`${r.type}-${r.id ?? i}`} item={r} index={i} onSelect={handleSelect} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;

