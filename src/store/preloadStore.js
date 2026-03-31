import { create } from 'zustand';
import { getBouquetsWithChannels, loadEPGForStreams } from '../services/tvDataService';
import { loadVODData } from '../services/vodService';
import panaccessService from '../services/panaccessService';
import { processAdsFromApi } from '../utils/adsData';
import { mergeEpgIntoChannels } from '../utils/epgMerge';

const LOADING_TIMEOUT_MS = 300000;

const epgInitialState = {
  status: 'idle', // 'idle' | 'loading' | 'finishing' | 'ready' | 'error'
  streams: [],
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
  groups: [],
  recorded: [],
  progress: { loadedGroups: 0, totalGroups: 0 },
  error: null,
  lastLoadedAt: null,
};

export const usePreloadStore = create((set, get) => {
  let loadingTimeout = null;
  let vodLoading = false;
  let adsLoading = false;
  let catchupLoading = false;

  const clearLoadingTimeout = () => {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
  };

  return {
    epg: epgInitialState,
    vod: vodInitialState,
    ads: adsInitialState,
    catchup: catchupInitialState,

    loadEPG: async (brandConfig, options = {}) => {
      if (!brandConfig) return;
      const { force = false } = options;
      const { epg } = get();
      if (epg.status === 'loading') return;
      if (
        !force &&
        epg.status === 'ready' &&
        Array.isArray(epg.bouquetsWithChannels) &&
        epg.bouquetsWithChannels.length > 0
      ) {
        return;
      }

      set((state) => ({
        ...state,
        epg: {
          ...state.epg,
          status: 'loading',
          error: null,
          bouquetsWithChannels: [],
          progress: { current: 0, total: 0, percent: 0 },
        },
      }));

      clearLoadingTimeout();
      loadingTimeout = setTimeout(() => {
        if (import.meta.env?.DEV) {
          console.warn('[PreloadStore] Timeout en carga de EPG, marcando como listo');
        }
        clearLoadingTimeout();
        set((state) => {
          if (state.epg.status !== 'loading') return state;
          return {
            ...state,
            epg: {
              ...state.epg,
              status: 'ready',
              lastLoadedAt: Date.now(),
              progress: { ...state.epg.progress, percent: 100 },
            },
          };
        });
      }, LOADING_TIMEOUT_MS);

      try {
        const bouquets = await getBouquetsWithChannels({ enableRetry: false });
        const allStreams = bouquets.flatMap((b) => b.items || []);
        const total = allStreams.length;

        if (total === 0) {
          clearLoadingTimeout();
          set((state) => ({
            ...state,
            epg: {
              ...state.epg,
              status: 'finishing',
              streams: [],
              bouquetsWithChannels: bouquets,
              progress: { current: 0, total: 0, percent: 100 },
            },
          }));
          setTimeout(() => {
            set((state) => ({
              ...state,
              epg: { ...state.epg, status: 'ready', lastLoadedAt: Date.now() },
            }));
          }, 500);
          return;
        }

        await loadEPGForStreams(allStreams, brandConfig, {
          maxChannels: total,
          onProgress: (current, totalProcessed) => {
            const percent =
              totalProcessed > 0
                ? Math.min(90, Math.max(10, Math.round((current / totalProcessed) * 100)))
                : 10;
            set((state) => ({
              ...state,
              epg: {
                ...state.epg,
                progress: { current, total: totalProcessed, percent },
              },
            }));
          },
        });

        clearLoadingTimeout();
        set((state) => {
          if (state.epg.status !== 'loading') {
            return {
              ...state,
              epg: {
                ...state.epg,
                streams: allStreams,
                bouquetsWithChannels: bouquets,
                progress: { current: total, total, percent: 100 },
                error: null,
              },
            };
          }
          return {
            ...state,
            epg: {
              ...state.epg,
              status: 'finishing',
              streams: allStreams,
              bouquetsWithChannels: bouquets,
              progress: { current: total, total, percent: 100 },
              error: null,
            },
          };
        });
        setTimeout(() => {
          set((state) => {
            if (state.epg.status !== 'finishing') return state;
            return { ...state, epg: { ...state.epg, status: 'ready', lastLoadedAt: Date.now() } };
          });
        }, 500);
      } catch (err) {
        clearLoadingTimeout();
        const message = err?.message || err?.errorInfo?.userMessage || 'Error al cargar EPG';
        if (import.meta.env?.DEV) console.warn('[PreloadStore] loadEPG error:', err);
        set((state) => ({
          ...state,
          epg: {
            ...state.epg,
            status: 'error',
            error: message,
            bouquetsWithChannels: [],
          },
        }));
      }
    },

    loadVOD: async (brandConfig, options = {}) => {
      if (!brandConfig || vodLoading) return;
      const { force = false, ...loadOptions } = options;
      const currentVod = get().vod;
      if (
        !force &&
        currentVod.status === 'ready' &&
        Array.isArray(currentVod.allVods) &&
        currentVod.allVods.length > 0
      ) {
        return;
      }
      vodLoading = true;
      set((state) => ({
        ...state,
        vod: { ...state.vod, status: 'loading', error: null, progress: { loadedCount: 0 } },
      }));

      const runLoad = (extra = {}) =>
        loadVODData(brandConfig, {
          ...loadOptions,
          ...extra,
          onProgress: (loadedCount) => {
            set((state) => ({
              ...state,
              vod: { ...state.vod, progress: { loadedCount } },
            }));
          },
        });

      try {
        let payload;
        try {
          payload = await runLoad();
        } catch (firstError) {
          if (import.meta.env?.DEV) {
            console.warn('[PreloadStore] loadVOD first attempt failed, retrying once:', firstError);
          }
          payload = await runLoad({ enableRetry: true });
        }

        const { categories, allVods, vodRecommended } = payload;
        set((state) => ({
          ...state,
          vod: {
            ...state.vod,
            status: 'ready',
            categories,
            allVods,
            vodRecommended,
            progress: { loadedCount: allVods.length },
            error: null,
            lastLoadedAt: Date.now(),
          },
        }));
      } catch (err) {
        const message = err?.message || 'Error al cargar VOD';
        if (import.meta.env?.DEV) console.warn('[PreloadStore] loadVOD error:', err);
        set((state) => {
          const prev = state.vod;
          const hasCachedData =
            (prev.categories?.length ?? 0) > 0 ||
            (prev.allVods?.length ?? 0) > 0 ||
            (prev.vodRecommended?.length ?? 0) > 0;
          if (hasCachedData) {
            return { ...state, vod: { ...prev, status: 'ready', error: null } };
          }
          return { ...state, vod: { ...prev, status: 'error', error: message } };
        });
      } finally {
        vodLoading = false;
      }
    },

    loadAds: async (options = {}) => {
      if (adsLoading) return;
      const { force = false } = options;
      const currentAds = get().ads;
      const hasAdsData =
        (currentAds.processed?.length ?? 0) > 0 ||
        (currentAds.top?.length ?? 0) > 0 ||
        (currentAds.bottom?.length ?? 0) > 0;
      if (!force && currentAds.status === 'ready' && hasAdsData) {
        return;
      }
      adsLoading = true;
      set((state) => ({ ...state, ads: { ...state.ads, status: 'loading', error: null } }));
      try {
        const raw = await panaccessService.getAds({ enableRetry: false });
        const list = Array.isArray(raw) ? raw : [];
        const { processed, top, bottom } = processAdsFromApi(list);
        set((state) => ({
          ...state,
          ads: { status: 'ready', processed, top, bottom, error: null, lastLoadedAt: Date.now() },
        }));
      } catch (err) {
        const message = err?.message || err?.errorInfo?.userMessage || 'Error al cargar publicidad';
        if (import.meta.env?.DEV) console.warn('[PreloadStore] loadAds error:', err);
        set((state) => ({
          ...state,
          ads: {
            status: 'error',
            processed: [],
            top: [],
            bottom: [],
            error: message,
            lastLoadedAt: null,
          },
        }));
      } finally {
        adsLoading = false;
      }
    },

    loadCatchup: async (brandConfig, options = {}) => {
      if (!brandConfig) return;
      const { force = false } = options;
      const { catchup } = get();
      if (catchup.status === 'loading') return;
      if (catchupLoading) return;
      if (
        !force &&
        catchup.status === 'ready' &&
        ((catchup.groups?.length ?? 0) > 0 || (catchup.recorded?.length ?? 0) > 0)
      ) {
        return;
      }
      catchupLoading = true;

      set((state) => ({
        ...state,
        catchup: {
          ...state.catchup,
          status: 'loading',
          error: null,
          groups: [],
          recorded: [],
          progress: { loadedGroups: 0, totalGroups: 0 },
        },
      }));

      const toMs = (v) => {
        if (v == null) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        const ms = new Date(v).getTime();
        return Number.isFinite(ms) ? ms : null;
      };

      const normalizeList = (resp, keys) => {
        if (Array.isArray(resp)) return resp;
        if (resp && typeof resp === 'object') {
          for (const k of keys) {
            const value = resp[k];
            if (Array.isArray(value)) return value;
          }
        }
        return [];
      };

      const buildGroupsWithEvents = async (enableRetry) => {
        const groupsResp = await panaccessService.getCatchupGroups({ enableRetry });
        const groupsList = normalizeList(groupsResp, ['catchupGroups', 'groups', 'items', 'answer']);
        groupsList.sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));

        const totalGroups = groupsList.length;
        const groupsWithEvents = [];

        for (let i = 0; i < groupsList.length; i++) {
          const group = groupsList[i];
          if (!group) continue;

          const epgStreamId = group.epgStreamId ?? group.epg_stream_id ?? group.epgStreamid;
          const eventsResp = await panaccessService.getCatchupEvents({ epgStreamId, enableRetry });
          const eventsList = normalizeList(eventsResp, ['events', 'items', 'answer']);
          const catchupGroupId = group.catchupGroupId ?? group.catchup_group_id ?? group.id ?? null;

          const mappedEvents = eventsList.map((ev) => {
            const startRaw = ev.start ?? ev.startDate ?? ev.start_date ?? null;
            const durationSeconds = Number(ev.duration ?? ev.durationSeconds ?? ev.duration_sec ?? 0);
            const endRaw = ev.end ?? ev.endDate ?? ev.end_date ?? null;

            const startMs = toMs(startRaw);
            const endMsFromDuration =
              startMs != null && Number.isFinite(durationSeconds) && durationSeconds > 0
                ? startMs + durationSeconds * 1000
                : null;
            const endMs = endMsFromDuration ?? toMs(endRaw);
            const resolvedCatchupId =
              ev.catchupId ?? ev.catchup_id ?? ev.catchupEventId ?? ev.id ?? ev.eventId ?? null;

            return {
              ...ev,
              catchupGroupId,
              catchupId: resolvedCatchupId,
              startDate: startMs != null ? new Date(startMs) : null,
              endDate: endMs != null ? new Date(endMs) : null,
              durationSeconds: durationSeconds > 0 ? durationSeconds : ev.durationSeconds ?? ev.duration ?? null,
            };
          });

          groupsWithEvents.push({ ...group, events: mappedEvents });
          set((state) => ({
            ...state,
            catchup: {
              ...state.catchup,
              progress: { loadedGroups: i + 1, totalGroups },
            },
          }));
        }

        return groupsWithEvents;
      };

      const prepareRecorded = (tasksList, groupsWithEvents) => {
        const validTasks = normalizeList(tasksList, ['recordingTasks', 'items', 'tasks', 'answer']).filter((t) => {
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
            const group = groupsWithEvents.find(
              (g) =>
                Array.isArray(g.events) &&
                g.events.some((ev) => String(ev?.id ?? ev?.eventId ?? ev?.catchupId ?? '') === taskCatchupIdStr)
            );
            if (!group) return null;

            const event = group.events.find(
              (ev) => String(ev?.id ?? ev?.eventId ?? ev?.catchupId ?? '') === taskCatchupIdStr
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
        const recorded = prepareRecorded(recordedResp, groupsWithEvents);
        return { groupsWithEvents, recorded };
      };

      try {
        let payload;
        try {
          payload = await runLoad(false);
        } catch (firstError) {
          if (import.meta.env?.DEV) {
            console.warn('[PreloadStore] loadCatchup first attempt failed, retrying once:', firstError);
          }
          payload = await runLoad(true);
        }

        set((state) => ({
          ...state,
          catchup: {
            ...state.catchup,
            status: 'ready',
            groups: payload.groupsWithEvents,
            recorded: payload.recorded,
            error: null,
            progress: {
              loadedGroups: payload.groupsWithEvents.length,
              totalGroups: payload.groupsWithEvents.length,
            },
            lastLoadedAt: Date.now(),
          },
        }));
      } catch (err) {
        const message = err?.message || 'Error al cargar catchup';
        set((state) => {
          const prev = state.catchup;
          const hasCachedData = (prev.groups?.length ?? 0) > 0 || (prev.recorded?.length ?? 0) > 0;
          if (hasCachedData) return { ...state, catchup: { ...prev, status: 'ready', error: null } };
          return { ...state, catchup: { ...prev, status: 'error', error: message } };
        });
      } finally {
        catchupLoading = false;
      }
    },

    resetPreload: () => {
      clearLoadingTimeout();
      vodLoading = false;
      adsLoading = false;
      catchupLoading = false;
      set(() => ({
        epg: epgInitialState,
        vod: vodInitialState,
        ads: adsInitialState,
        catchup: catchupInitialState,
      }));
    },

    getStreamsWithEPG: (channels) => {
      const { epg } = get();
      return mergeEpgIntoChannels(channels || [], epg.streams);
    },
  };
});

