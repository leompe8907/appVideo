/**
 * Contexto de precarga de datos (EPG, VOD, publicidad; en el futuro catchups, OSMS).
 * Centraliza la descarga y el estado para uso en bouquets, player, VOD y Home.
 */

import { createContext, useContext, useCallback, useRef, useState } from 'react';
import { getBouquetsWithChannels, loadEPGForStreams } from '../services/tvDataService';
import { loadVODData } from '../services/vodService';
import panaccessService from '../services/panaccessService';
import { processAdsFromApi } from '../utils/adsData';

const LOADING_TIMEOUT_MS = 300000;

const epgInitialState = {
  status: 'idle', // 'idle' | 'loading' | 'finishing' | 'ready' | 'error'
  streams: [],
  /** Resultado de getBouquetsWithChannels (bouquets con items); evita repetir getBouquets/getAvailableStreams en Inicio */
  bouquetsWithChannels: [],
  progress: { current: 0, total: 0, percent: 0 },
  error: null,
  lastLoadedAt: null,
};

const vodInitialState = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  categories: [],
  allVods: [],
  vodRecommended: [],
  progress: { loadedCount: 0 },
  error: null,
  lastLoadedAt: null,
};

const adsInitialState = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  processed: [],
  top: [],
  bottom: [],
  error: null,
  lastLoadedAt: null,
};

const catchupInitialState = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  groups: [], // [{ catchupGroupId, epgStreamId, lcn, name, img, events: [...] }]
  recorded: [], // array de tareas de grabación ya normalizadas con metadata (event, image, lcn, catchupName...)
  progress: { loadedGroups: 0, totalGroups: 0 },
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
  const [epg, setEpg] = useState(epgInitialState);
  const [vod, setVod] = useState(vodInitialState);
  const [ads, setAds] = useState(adsInitialState);
  const [catchup, setCatchup] = useState(catchupInitialState);
  const loadingTimeoutRef = useRef(null);
  const loadingStartedRef = useRef(false);
  const vodLoadingRef = useRef(false);
  const adsLoadingRef = useRef(false);
  const catchupLoadingRef = useRef(false);

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
        bouquetsWithChannels: [],
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
            bouquetsWithChannels: bouquets,
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
        setEpg((prev) => {
          // Si el timeout ya marcó 'ready', solo actualizar datos; no volver a 'finishing' para evitar
          // que el usuario vuelva a ver la pantalla de carga y luego "regrese" a bouquets.
          if (prev.status !== 'loading') {
            return {
              ...prev,
              streams: allStreams,
              bouquetsWithChannels: bouquets,
              progress: { current: total, total, percent: 100 },
              error: null,
            };
          }
          return {
            ...prev,
            status: 'finishing',
            streams: allStreams,
            bouquetsWithChannels: bouquets,
            progress: { current: total, total, percent: 100 },
            error: null,
          };
        });
        setTimeout(() => {
          setEpg((prev) => {
            if (prev.status !== 'finishing') return prev;
            return { ...prev, status: 'ready', lastLoadedAt: Date.now() };
          });
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
          bouquetsWithChannels: [],
          progress: prev.progress,
        }));
      } finally {
        loadingStartedRef.current = false;
      }
    },
    [clearTimeoutRef, epg.status]
  );

  /**
   * Carga VOD en segundo plano (en paralelo con EPG). No bloquea la pantalla de preload.
   * Se ejecuta al mismo tiempo que loadEPG; cuando termina, vod.status pasa a 'ready'.
   */
  const loadVOD = useCallback(async (brandConfig, options = {}) => {
    if (!brandConfig || vodLoadingRef.current) return;
    vodLoadingRef.current = true;
    setVod((prev) => ({ ...prev, status: 'loading', error: null, progress: { loadedCount: 0 } }));

    const runLoad = (extra = {}) =>
      loadVODData(brandConfig, {
        ...options,
        ...extra,
        onProgress: (loadedCount) => {
          setVod((prev) => ({ ...prev, progress: { loadedCount } }));
        },
      });

    try {
      let payload;
      try {
        payload = await runLoad();
      } catch (firstError) {
        // Reintento interno único para evitar errores transitorios de red/backend.
        if (import.meta.env?.DEV) {
          console.warn('[Preload] loadVOD first attempt failed, retrying once:', firstError);
        }
        payload = await runLoad({ enableRetry: true });
      }

      const { categories, allVods, vodRecommended } = payload;
      setVod((prev) => ({
        ...prev,
        status: 'ready',
        categories,
        allVods,
        vodRecommended,
        progress: { loadedCount: allVods.length },
        error: null,
        lastLoadedAt: Date.now(),
      }));
    } catch (err) {
      const message = err?.message || 'Error al cargar VOD';
      if (import.meta.env?.DEV) console.warn('[Preload] loadVOD error:', err);
      setVod((prev) => {
        const hasCachedData =
          (prev.categories?.length ?? 0) > 0 ||
          (prev.allVods?.length ?? 0) > 0 ||
          (prev.vodRecommended?.length ?? 0) > 0;

        // Si ya hay datos cargados en memoria, mantenerlos visibles y evitar estado de error bloqueante.
        if (hasCachedData) {
          return {
            ...prev,
            status: 'ready',
            error: null,
          };
        }

        return {
          ...prev,
          status: 'error',
          error: message,
          progress: prev.progress,
        };
      });
    } finally {
      vodLoadingRef.current = false;
    }
  }, []);

  /**
   * Publicidad HTML5 (getAds). No bloquea la salida de PreloadDataPage; se ejecuta en paralelo con EPG/VOD.
   */
  const loadAds = useCallback(async () => {
    if (adsLoadingRef.current) return;
    adsLoadingRef.current = true;
    setAds((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const raw = await panaccessService.getAds({ enableRetry: false });
      const list = Array.isArray(raw) ? raw : [];
      const { processed, top, bottom } = processAdsFromApi(list);
      setAds({
        status: 'ready',
        processed,
        top,
        bottom,
        error: null,
        lastLoadedAt: Date.now(),
      });
    } catch (err) {
      const message = err?.message || err?.errorInfo?.userMessage || 'Error al cargar publicidad';
      if (import.meta.env?.DEV) {
        console.warn('[Preload] loadAds error:', err);
      }
      setAds({
        status: 'error',
        processed: [],
        top: [],
        bottom: [],
        error: message,
        lastLoadedAt: null,
      });
    } finally {
      adsLoadingRef.current = false;
    }
  }, []);

  const loadCatchup = useCallback(
    async (brandConfig, options = {}) => {
      if (!brandConfig) return;
      if (catchup.status === 'loading') return;
      if (catchupLoadingRef.current) return;

      catchupLoadingRef.current = true;
      setCatchup((prev) => ({
        ...prev,
        status: 'loading',
        error: null,
        groups: [],
        recorded: [],
        progress: { loadedGroups: 0, totalGroups: 0 },
      }));

      const toMs = (v) => {
        if (v == null) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        const ms = new Date(v).getTime();
        return Number.isFinite(ms) ? ms : null;
      };

      const normalizeGroups = (resp) => {
        if (Array.isArray(resp)) return resp;
        if (resp && typeof resp === 'object') {
          return resp.catchupGroups || resp.groups || resp.items || resp.answer || [];
        }
        return [];
      };

      const normalizeEvents = (resp) => {
        if (Array.isArray(resp)) return resp;
        if (resp && typeof resp === 'object') {
          return resp.events || resp.items || resp.answer || [];
        }
        return [];
      };

      const normalizeRecorded = (resp) => {
        if (Array.isArray(resp)) return resp;
        if (resp && typeof resp === 'object') {
          return resp.recordingTasks || resp.items || resp.tasks || resp.answer || [];
        }
        return [];
      };

      const buildGroupsWithEvents = async (enableRetry) => {
        const groupsResp = await panaccessService.getCatchupGroups({ enableRetry });
        const groupsList = normalizeGroups(groupsResp);
        groupsList.sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));

        const totalGroups = groupsList.length;
        const groupsWithEvents = [];

        for (let i = 0; i < groupsList.length; i++) {
          const group = groupsList[i];
          if (!group) continue;

          const epgStreamId = group.epgStreamId ?? group.epg_stream_id ?? group.epgStreamid;
          const eventsResp = await panaccessService.getCatchupEvents({
            epgStreamId,
            enableRetry,
          });

          const eventsList = normalizeEvents(eventsResp);
          const catchupGroupId = group.catchupGroupId ?? group.catchup_group_id ?? group.id ?? null;

          const mappedEvents = eventsList.map((ev) => {
            const startRaw = ev.start ?? ev.startDate ?? ev.start_date ?? null;
            const durationSeconds = Number(ev.duration ?? ev.durationSeconds ?? ev.duration_sec ?? 0);
            const endRaw = ev.end ?? ev.endDate ?? ev.end_date ?? null;

            const startMs = toMs(startRaw);
            const endMsFromDuration =
              startMs != null && Number.isFinite(durationSeconds) && durationSeconds > 0 ? startMs + durationSeconds * 1000 : null;
            const endMs = endMsFromDuration ?? toMs(endRaw);

            const resolvedCatchupId = ev.catchupId ?? ev.catchup_id ?? ev.catchupEventId ?? ev.id ?? ev.eventId ?? null;

            return {
              ...ev,
              catchupGroupId,
              catchupId: resolvedCatchupId,
              startDate: startMs != null ? new Date(startMs) : null,
              endDate: endMs != null ? new Date(endMs) : null,
              durationSeconds: durationSeconds > 0 ? durationSeconds : ev.durationSeconds ?? ev.duration ?? null,
            };
          });

          groupsWithEvents.push({
            ...group,
            events: mappedEvents,
          });

          setCatchup((prev) => ({
            ...prev,
            progress: { loadedGroups: i + 1, totalGroups },
          }));
        }

        return groupsWithEvents;
      };

      const prepareRecorded = (tasksList, groupsWithEvents) => {
        const validTasks = normalizeRecorded(tasksList).filter((t) => {
          const mode = Number(t.mode ?? 0);
          const catchupId = Number(t.catchupId ?? t.catchup_id ?? t.id ?? 0);
          const deleted = !!t.deleted;
          return mode === 4 && catchupId > 0 && !deleted;
        });

        const recorded = validTasks
          .map((task) => {
            const taskCatchupId = task.catchupId ?? task.catchup_id ?? task.id ?? null;
            if (taskCatchupId == null) return null;

            const taskCatchupIdStr = String(taskCatchupId);
            const group = groupsWithEvents.find((g) =>
              Array.isArray(g.events) &&
              g.events.some((ev) => String(ev?.id ?? ev?.eventId ?? ev?.catchupId ?? '') === taskCatchupIdStr)
            );

            if (!group) return null;

            const event = group.events.find((ev) =>
              String(ev?.id ?? ev?.eventId ?? ev?.catchupId ?? '') === taskCatchupIdStr
            );

            if (!event) return null;

            const startMs = toMs(task.startDate ?? task.start ?? null);

            return {
              ...task,
              catchupId: Number(taskCatchupIdStr),
              startDate: startMs != null ? new Date(startMs) : null,
              event,
              image: group.img ?? group.imageUrl ?? group.posterUrl ?? null,
              lcn: group.lcn ?? null,
              catchupName: group.name ?? null,
            };
          })
          .filter(Boolean);

        recorded.sort((a, b) => {
          const aa = a.startDate?.valueOf?.() ?? 0;
          const bb = b.startDate?.valueOf?.() ?? 0;
          return aa - bb;
        });

        return recorded;
      };

      const runLoad = async (enableRetry) => {
        const groupsWithEvents = await buildGroupsWithEvents(enableRetry);
        const recordedResp = await panaccessService.getRecordingTasks({ enableRetry });
        const recordedTasks = normalizeRecorded(recordedResp);
        const recorded = prepareRecorded(recordedTasks, groupsWithEvents);

        return { groupsWithEvents, recorded };
      };

      try {
        let payload;
        try {
          payload = await runLoad(false);
        } catch (firstError) {
          if (import.meta.env?.DEV) {
            console.warn('[Preload] loadCatchup first attempt failed, retrying once:', firstError);
          }
          payload = await runLoad(true);
        }

        setCatchup((prev) => ({
          ...prev,
          status: 'ready',
          groups: payload.groupsWithEvents,
          recorded: payload.recorded,
          error: null,
          progress: { loadedGroups: payload.groupsWithEvents.length, totalGroups: payload.groupsWithEvents.length },
          lastLoadedAt: Date.now(),
        }));
      } catch (err) {
        const message = err?.message || 'Error al cargar catchup';
        setCatchup((prev) => {
          const hasCachedData = (prev.groups?.length ?? 0) > 0 || (prev.recorded?.length ?? 0) > 0;
          if (hasCachedData) {
            return { ...prev, status: 'ready', error: null };
          }
          return { ...prev, status: 'error', error: message };
        });
      } finally {
        catchupLoadingRef.current = false;
      }
    },
    [catchup.status]
  );

  const resetPreload = useCallback(() => {
    clearTimeoutRef();
    setEpg(epgInitialState);
    setVod(vodInitialState);
    setAds(adsInitialState);
    setCatchup(catchupInitialState);
    loadingStartedRef.current = false;
    vodLoadingRef.current = false;
    adsLoadingRef.current = false;
    catchupLoadingRef.current = false;
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
    vod,
    loadVOD,
    ads,
    loadAds,
    catchup,
    loadCatchup,
    resetPreload,
    getStreamsWithEPG,
  };

  return <PreloadContext.Provider value={value}>{children}</PreloadContext.Provider>;
}

export default PreloadContext;
