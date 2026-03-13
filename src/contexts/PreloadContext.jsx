/**
 * Contexto de precarga de datos (EPG, y en el futuro catchups, VOD, ads, OSMS).
 * Centraliza la descarga y el estado para uso en bouquets, player y futuros componentes.
 */

import { createContext, useContext, useCallback, useRef, useState } from 'react';
import { getBouquetsWithChannels, loadEPGForStreams } from '../services/tvDataService';

const LOADING_TIMEOUT_MS = 30000;

const initialState = {
  status: 'idle', // 'idle' | 'loading' | 'finishing' | 'ready' | 'error'
  streams: [],
  progress: { current: 0, total: 0, percent: 0 },
  error: null,
  lastLoadedAt: null,
};

const PreloadContext = createContext(null);

export function usePreload() {
  const ctx = useContext(PreloadContext);
  if (!ctx) {
    throw new Error('usePreload debe usarse dentro de PreloadProvider');
  }
  return ctx;
}

/**
 * Fusiona epgItems del preload en la lista de canales recibida (por id / epgStreamId).
 * @param {Array} channels - Canales que devuelve getBouquetsWithChannels
 * @param {Array} streamsWithEpg - Streams con epgItems del PreloadContext
 * @returns {Array} Canales con epgItems rellenados cuando existan en preload
 */
export function mergeEpgIntoChannels(channels, streamsWithEpg) {
  if (!Array.isArray(channels) || !Array.isArray(streamsWithEpg) || streamsWithEpg.length === 0) {
    return channels;
  }
  const byId = new Map();
  const byEpgId = new Map();
  streamsWithEpg.forEach((s) => {
    if (s.id != null) byId.set(String(s.id), s);
    if (s.epgStreamId != null) byEpgId.set(String(s.epgStreamId), s);
  });
  return channels.map((ch) => {
    const id = ch.id != null ? String(ch.id) : null;
    const epgId = ch.epgStreamId != null ? String(ch.epgStreamId) : null;
    const fromPreload = (id && byId.get(id)) || (epgId && byEpgId.get(epgId));
    if (!fromPreload || !Array.isArray(fromPreload.epgItems)) return ch;
    return { ...ch, epgItems: fromPreload.epgItems };
  });
}

export function PreloadProvider({ children }) {
  const [epg, setEpg] = useState(initialState);
  const loadingTimeoutRef = useRef(null);
  const loadingStartedRef = useRef(false);

  const clearTimeoutRef = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const loadEPG = useCallback(
    async (brandConfig) => {
      if (!brandConfig) return;
      if (epg.status === 'loading') return;
      loadingStartedRef.current = true;
      setEpg((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        progress: { current: 0, total: 0, percent: 0 },
      }));

      loadingTimeoutRef.current = setTimeout(() => {
        if (import.meta.env?.DEV) {
          console.warn('[Preload] Timeout en carga de EPG, marcando como listo');
        }
        clearTimeoutRef();
        setEpg((prev) => {
          if (prev.status !== 'loading') return prev;
          return {
            ...prev,
            status: 'ready',
            lastLoadedAt: Date.now(),
            progress: { ...prev.progress, percent: 100 },
          };
        });
      }, LOADING_TIMEOUT_MS);

      try {
        const bouquets = await getBouquetsWithChannels({ enableRetry: false });
        const allStreams = bouquets.flatMap((b) => b.items || []);
        const total = allStreams.length;
        if (total === 0) {
          clearTimeoutRef();
          setEpg((prev) => ({
            ...prev,
            status: 'finishing',
            streams: [],
            progress: { current: 0, total: 0, percent: 100 },
          }));
          setTimeout(() => {
            setEpg((prev) => ({ ...prev, status: 'ready', lastLoadedAt: Date.now() }));
          }, 500);
          return;
        }

        // Cargar EPG para todos los canales del usuario (sin límite por rowsOnInit)
        const maxChannels = total;

        await loadEPGForStreams(allStreams, brandConfig, {
          maxChannels,
          onProgress: (current, totalProcessed) => {
            const percent = totalProcessed > 0
              ? Math.min(90, Math.max(10, Math.round((current / totalProcessed) * 100)))
              : 10;
            setEpg((prev) => ({
              ...prev,
              progress: { current, total: totalProcessed, percent },
            }));
          },
        });

        clearTimeoutRef();
        setEpg((prev) => ({
          ...prev,
          status: 'finishing',
          streams: allStreams,
          progress: { current: total, total, percent: 100 },
          error: null,
        }));
        setTimeout(() => {
          setEpg((prev) => ({ ...prev, status: 'ready', lastLoadedAt: Date.now() }));
        }, 500);
      } catch (err) {
        clearTimeoutRef();
        const message = err?.message || err?.errorInfo?.userMessage || 'Error al cargar EPG';
        if (import.meta.env?.DEV) {
          console.warn('[Preload] loadEPG error:', err);
        }
        setEpg((prev) => ({
          ...prev,
          status: 'error',
          error: message,
          progress: prev.progress,
        }));
      } finally {
        loadingStartedRef.current = false;
      }
    },
    [clearTimeoutRef, epg.status]
  );

  const resetPreload = useCallback(() => {
    clearTimeoutRef();
    setEpg(initialState);
    loadingStartedRef.current = false;
  }, [clearTimeoutRef]);

  /**
   * Devuelve los canales con epgItems fusionados desde el preload cuando existan.
   */
  const getStreamsWithEPG = useCallback(
    (channels) => {
      return mergeEpgIntoChannels(channels || [], epg.streams);
    },
    [epg.streams]
  );

  const value = {
    epg,
    loadEPG,
    resetPreload,
    getStreamsWithEPG,
  };

  return <PreloadContext.Provider value={value}>{children}</PreloadContext.Provider>;
}

export default PreloadContext;
