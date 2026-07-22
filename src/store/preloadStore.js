import { create } from 'zustand';
import { getBouquetsWithChannels, loadEPGForStreams } from '../services/tvDataService';
import { loadVODData } from '../services/vodService';
import panaccessService from '../services/panaccessService';
import { processAdsFromApi } from '../utils/adsData';
import { mergeEpgIntoChannels } from '../utils/epgMerge';
import { dedupeStreams } from '../utils/channelId';
import { normalizeList, prepareRecorded, toMs } from './catchupRecorded';

// FIX #1: Evaluar IS_DEV a nivel de módulo, fuera de cualquier closure asíncrono.
// En closures de setTimeout/catch, `import.meta` puede ser undefined en WebKit 2019 (producción).
const IS_DEV =
  typeof import.meta !== 'undefined' &&
  import.meta.env != null &&
  import.meta.env.DEV === true;

/** Solo VOD preload: cortafuegos global si la carga entera se cuelga. */
const VOD_LOADING_TIMEOUT_MS = 300000;

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

// FIX #2: Flags de control fuera del closure de create() para evitar que el
// code-splitting de producción las resetee al re-evaluar el módulo.
let vodTimeout = null;
let vodLoading = false;
let adsLoading = false;
let catchupLoading = false;

const clearVodTimeout = () => {
  if (vodTimeout) {
    clearTimeout(vodTimeout);
    vodTimeout = null;
  }
};

export const usePreloadStore = create(function (set, get) {
  return {
    epg: epgInitialState,
    vod: vodInitialState,
    ads: adsInitialState,
    catchup: catchupInitialState,

    loadEPG: async function (brandConfig, options) {
      var opts = options || {};
      var force = opts.force === true;
      if (!brandConfig) return;
      var state0 = get();
      var epg0 = state0.epg;
      if (epg0.status === 'loading') return;
      if (
        !force &&
        epg0.status === 'ready' &&
        Array.isArray(epg0.bouquetsWithChannels) &&
        epg0.bouquetsWithChannels.length > 0
      ) {
        return;
      }

      set(function (s) {
        return {
          epg: {
            status: 'loading',
            error: null,
            streams: s.epg.streams,
            bouquetsWithChannels: s.epg.bouquetsWithChannels,
            progress: { current: 0, total: 0, percent: 0 },
            lastLoadedAt: s.epg.lastLoadedAt,
          },
          vod: s.vod,
          ads: s.ads,
          catchup: s.catchup,
        };
      });

      var bouquets = [];
      var allStreams = [];

      try {
        bouquets = await getBouquetsWithChannels({ enableRetry: false });
        var allStreamsRaw = bouquets.reduce(function (acc, b) {
          return acc.concat(b.items || []);
        }, []);
        allStreams = dedupeStreams(allStreamsRaw);
        var total = allStreams.length;

        set(function (s) {
          return {
            epg: {
              status: 'loading',
              error: null,
              streams: allStreams.slice(),
              bouquetsWithChannels: bouquets,
              progress: { current: 0, total: total, percent: total > 0 ? 10 : 100 },
              lastLoadedAt: s.epg.lastLoadedAt,
            },
            vod: s.vod,
            ads: s.ads,
            catchup: s.catchup,
          };
        });

        if (total === 0) {
          set(function (s) {
            return {
              epg: {
                status: 'ready',
                streams: [],
                bouquetsWithChannels: bouquets,
                progress: { current: 0, total: 0, percent: 100 },
                error: null,
                lastLoadedAt: Date.now(),
              },
              vod: s.vod,
              ads: s.ads,
              catchup: s.catchup,
            };
          });
          return;
        }

        await loadEPGForStreams(allStreams, brandConfig, {
          maxChannels: total,
          onProgress: function (current, totalProcessed) {
            var percent =
              totalProcessed > 0
                ? Math.min(99, Math.max(10, Math.round((current / totalProcessed) * 100)))
                : 10;
            set(function (s) {
              return {
                epg: {
                  status: 'loading',
                  error: null,
                  streams: allStreams.slice(),
                  bouquetsWithChannels: bouquets,
                  progress: { current: current, total: totalProcessed, percent: percent },
                  lastLoadedAt: s.epg.lastLoadedAt,
                },
                vod: s.vod,
                ads: s.ads,
                catchup: s.catchup,
              };
            });
          },
        });

        set(function (s) {
          return {
            epg: {
              status: 'ready',
              streams: allStreams.slice(),
              bouquetsWithChannels: bouquets,
              progress: { current: total, total: total, percent: 100 },
              error: null,
              lastLoadedAt: Date.now(),
            },
            vod: s.vod,
            ads: s.ads,
            catchup: s.catchup,
          };
        });
      } catch (err) {
        var epgErrMsg = (err && err.message) || (err && err.errorInfo && err.errorInfo.userMessage) || 'Error al cargar EPG';
        var hasBouquets = bouquets.length > 0;
        if (IS_DEV) console.warn('[PreloadStore] loadEPG error:', err);
        set(function (s) {
          return {
            epg: {
              status: hasBouquets ? 'ready' : 'error',
              streams: allStreams.length > 0 ? allStreams.slice() : s.epg.streams,
              bouquetsWithChannels: bouquets,
              progress: s.epg.progress,
              error: hasBouquets ? epgErrMsg : epgErrMsg,
              lastLoadedAt: hasBouquets ? Date.now() : s.epg.lastLoadedAt,
            },
            vod: s.vod,
            ads: s.ads,
            catchup: s.catchup,
          };
        });
      }
    },

    loadVOD: async function (brandConfig, options) {
      if (!brandConfig || vodLoading) return;
      var opts = options || {};
      var force = opts.force === true;
      var loadOptions = {};
      // copy loadOptions excluding 'force' and 't'
      Object.keys(opts).forEach(function (k) {
        if (k !== 'force') loadOptions[k] = opts[k];
      });

      var currentVod = get().vod;
      if (
        !force &&
        currentVod.status === 'ready' &&
        Array.isArray(currentVod.allVods) &&
        currentVod.allVods.length > 0
      ) {
        return;
      }
      vodLoading = true;
      set(function (s) {
        return {
          epg: s.epg,
          vod: { status: 'loading', error: null, categories: s.vod.categories, allVods: s.vod.allVods, vodRecommended: s.vod.vodRecommended, progress: { loadedCount: 0 }, lastLoadedAt: s.vod.lastLoadedAt },
          ads: s.ads,
          catchup: s.catchup,
        };
      });

      // Safety net: VOD no debe bloquear indefinidamente el flujo de preload.
      clearVodTimeout();
      vodTimeout = setTimeout(function () {
        clearVodTimeout();
        set(function (s) {
          if (s.vod.status !== 'loading') return s;
          return {
            epg: s.epg,
            vod: { status: 'error', error: s.vod.error || 'Timeout al cargar VOD', categories: s.vod.categories, allVods: s.vod.allVods, vodRecommended: s.vod.vodRecommended, progress: s.vod.progress, lastLoadedAt: s.vod.lastLoadedAt },
            ads: s.ads,
            catchup: s.catchup,
          };
        });
      }, VOD_LOADING_TIMEOUT_MS);

      var runLoad = function (extra) {
        return loadVODData(brandConfig, Object.assign({}, loadOptions, extra || {}, {
          onProgress: function (loadedCount) {
            set(function (s) {
              return {
                epg: s.epg,
                vod: { status: s.vod.status, error: s.vod.error, categories: s.vod.categories, allVods: s.vod.allVods, vodRecommended: s.vod.vodRecommended, progress: { loadedCount: loadedCount }, lastLoadedAt: s.vod.lastLoadedAt },
                ads: s.ads,
                catchup: s.catchup,
              };
            });
          },
        }));
      };

      try {
        var payload;
        try {
          payload = await runLoad();
        } catch (firstError) {
          // FIX #1: IS_DEV en vez de import.meta.env?.DEV
          if (IS_DEV) {
            console.warn('[PreloadStore] loadVOD first attempt failed, retrying once:', firstError);
          }
          payload = await runLoad({ enableRetry: true });
        }

        var categories = payload.categories;
        var allVods = payload.allVods;
        var vodRecommended = payload.vodRecommended;
        clearVodTimeout();
        set(function (s) {
          return {
            epg: s.epg,
            vod: { status: 'ready', categories: categories, allVods: allVods, vodRecommended: vodRecommended, progress: { loadedCount: allVods.length }, error: null, lastLoadedAt: Date.now() },
            ads: s.ads,
            catchup: s.catchup,
          };
        });
      } catch (err) {
        var vodErrMsg = (err && err.message) || 'Error al cargar VOD';
        if (IS_DEV) console.warn('[PreloadStore] loadVOD error:', err);
        clearVodTimeout();
        set(function (s) {
          var prev = s.vod;
          var hasCachedData =
            (prev.categories && prev.categories.length > 0) ||
            (prev.allVods && prev.allVods.length > 0) ||
            (prev.vodRecommended && prev.vodRecommended.length > 0);
          if (hasCachedData) {
            return { epg: s.epg, vod: { status: 'ready', error: null, categories: prev.categories, allVods: prev.allVods, vodRecommended: prev.vodRecommended, progress: prev.progress, lastLoadedAt: prev.lastLoadedAt }, ads: s.ads, catchup: s.catchup };
          }
          return { epg: s.epg, vod: { status: 'error', error: vodErrMsg, categories: prev.categories, allVods: prev.allVods, vodRecommended: prev.vodRecommended, progress: prev.progress, lastLoadedAt: prev.lastLoadedAt }, ads: s.ads, catchup: s.catchup };
        });
      } finally {
        vodLoading = false;
      }
    },

    loadAds: async function (options) {
      if (adsLoading) return;
      var opts = options || {};
      var force = opts.force === true;
      var currentAds = get().ads;
      var hasAdsData =
        (currentAds.processed && currentAds.processed.length > 0) ||
        (currentAds.top && currentAds.top.length > 0) ||
        (currentAds.bottom && currentAds.bottom.length > 0);
      if (!force && currentAds.status === 'ready' && hasAdsData) {
        return;
      }
      adsLoading = true;
      set(function (s) {
        return { epg: s.epg, vod: s.vod, ads: { status: 'loading', error: null, processed: s.ads.processed, top: s.ads.top, bottom: s.ads.bottom, lastLoadedAt: s.ads.lastLoadedAt }, catchup: s.catchup };
      });

      try {
        var raw = await panaccessService.getAds({ enableRetry: false });
        var list = Array.isArray(raw) ? raw : [];
        var adsResult = processAdsFromApi(list);
        set(function (s) {
          return { epg: s.epg, vod: s.vod, ads: { status: 'ready', processed: adsResult.processed, top: adsResult.top, bottom: adsResult.bottom, error: null, lastLoadedAt: Date.now() }, catchup: s.catchup };
        });
      } catch (err) {
        var adsErrMsg = (err && err.message) || (err && err.errorInfo && err.errorInfo.userMessage) || 'Error al cargar publicidad';
        if (IS_DEV) console.warn('[PreloadStore] loadAds error:', err);
        set(function (s) {
          return { epg: s.epg, vod: s.vod, ads: { status: 'error', processed: [], top: [], bottom: [], error: adsErrMsg, lastLoadedAt: null }, catchup: s.catchup };
        });
      } finally {
        adsLoading = false;
      }
    },

    loadCatchup: async function (brandConfig, options) {
      if (!brandConfig) return;
      var opts = options || {};
      var force = opts.force === true;
      var catchupState = get().catchup;
      if (catchupState.status === 'loading') return;
      if (catchupLoading) return;
      if (
        !force &&
        catchupState.status === 'ready' &&
        ((catchupState.groups && catchupState.groups.length > 0) || (catchupState.recorded && catchupState.recorded.length > 0))
      ) {
        return;
      }
      catchupLoading = true;

      set(function (s) {
        return {
          epg: s.epg,
          vod: s.vod,
          ads: s.ads,
          catchup: { status: 'loading', error: null, groups: [], recorded: [], progress: { loadedGroups: 0, totalGroups: 0 }, lastLoadedAt: s.catchup.lastLoadedAt },
        };
      });

      var buildGroupsWithEvents = async function (enableRetry) {
        var groupsResp = await panaccessService.getCatchupGroups({ enableRetry: enableRetry });
        var groupsList = normalizeList(groupsResp, ['catchupGroups', 'groups', 'items', 'answer']);
        groupsList.sort(function (a, b) { return Number(a.lcn || 0) - Number(b.lcn || 0); });

        var totalGroups = groupsList.length;
        var groupsWithEvents = [];
        var BATCH_SIZE = 4;
        var loadedGroupsCount = 0;

        set(function (s) {
          return {
            epg: s.epg,
            vod: s.vod,
            ads: s.ads,
            catchup: { status: s.catchup.status, error: s.catchup.error, groups: s.catchup.groups, recorded: s.catchup.recorded, progress: { loadedGroups: 0, totalGroups: totalGroups }, lastLoadedAt: s.catchup.lastLoadedAt },
          };
        });

        for (var start = 0; start < groupsList.length; start += BATCH_SIZE) {
          var batch = groupsList.slice(start, start + BATCH_SIZE);
          var results = await Promise.all(batch.map(async function(group) {
            if (!group) return { group: null, eventsList: [] };

            var epgStreamId = group.epgStreamId != null ? group.epgStreamId : (group.epg_stream_id != null ? group.epg_stream_id : group.epgStreamid);
            try {
              var eventsResp = await panaccessService.getCatchupEvents({ epgStreamId: epgStreamId, enableRetry: enableRetry });
              var eventsList = normalizeList(eventsResp, ['events', 'items', 'answer']);
              return { group: group, eventsList: eventsList };
            } catch (err) {
              if (IS_DEV) console.warn('[PreloadStore] Error loading catchup events for group:', group, err);
              return { group: group, eventsList: [] };
            }
          }));

          results.forEach(function (res) {
            var group = res.group;
            var eventsList = res.eventsList;
            if (!group) return;

            var catchupGroupId = group.catchupGroupId != null ? group.catchupGroupId : (group.catchup_group_id != null ? group.catchup_group_id : (group.id != null ? group.id : null));

            var mappedEvents = eventsList.map(function (ev) {
              var startRaw = ev.start != null ? ev.start : (ev.startDate != null ? ev.startDate : (ev.start_date != null ? ev.start_date : null));
              var durationSeconds = Number(ev.duration != null ? ev.duration : (ev.durationSeconds != null ? ev.durationSeconds : (ev.duration_sec != null ? ev.duration_sec : 0)));
              var endRaw = ev.end != null ? ev.end : (ev.endDate != null ? ev.endDate : (ev.end_date != null ? ev.end_date : null));

              var startMs = toMs(startRaw);
              var endMsFromDuration =
                startMs != null && isFinite(durationSeconds) && durationSeconds > 0
                  ? startMs + durationSeconds * 1000
                  : null;
              var endMs = endMsFromDuration != null ? endMsFromDuration : toMs(endRaw);
              // Paridad 10foot: getCatchupM3u8 usa event.id (no eventId de rejilla).
              var resolvedCatchupId =
                ev.id != null ? ev.id
                : ev.catchupId != null ? ev.catchupId
                : ev.catchup_id != null ? ev.catchup_id
                : ev.catchupEventId != null ? ev.catchupEventId
                : ev.eventId != null ? ev.eventId
                : null;

              var result = {};
              Object.keys(ev).forEach(function(k) { result[k] = ev[k]; });
              result.catchupGroupId = catchupGroupId;
              result.catchupId = resolvedCatchupId;
              result.startDate = startMs != null ? new Date(startMs) : null;
              result.endDate = endMs != null ? new Date(endMs) : null;
              result.durationSeconds = durationSeconds > 0 ? durationSeconds : (ev.durationSeconds != null ? ev.durationSeconds : (ev.duration != null ? ev.duration : null));
              return result;
            });

            var groupWithEvents = {};
            Object.keys(group).forEach(function(k) { groupWithEvents[k] = group[k]; });
            groupWithEvents.events = mappedEvents;
            groupsWithEvents.push(groupWithEvents);
            loadedGroupsCount++;
          });
          
          set(function (s) {
            return {
              epg: s.epg,
              vod: s.vod,
              ads: s.ads,
              catchup: { status: s.catchup.status, error: s.catchup.error, groups: s.catchup.groups, recorded: s.catchup.recorded, progress: { loadedGroups: loadedGroupsCount, totalGroups: totalGroups }, lastLoadedAt: s.catchup.lastLoadedAt },
            };
          });
        }

        return groupsWithEvents;
      };

      // `prepareRecorded`/`normalizeList`/`toMs` viven en `./catchupRecorded`
      // (import de arriba) — lógica pura movida ahí para poder testearla sin
      // instanciar este store.
      var runLoad = async function (enableRetry) {
        var groupsWithEvents = await buildGroupsWithEvents(enableRetry);
        var recordedResp = await panaccessService.getRecordingTasks({ enableRetry: enableRetry });
        var recorded = prepareRecorded(recordedResp, groupsWithEvents);
        return { groupsWithEvents: groupsWithEvents, recorded: recorded };
      };

      try {
        var payload;
        try {
          payload = await runLoad(false);
        } catch (firstError) {
          // FIX #1: IS_DEV en vez de import.meta.env?.DEV
          if (IS_DEV) {
            console.warn('[PreloadStore] loadCatchup first attempt failed, retrying once:', firstError);
          }
          payload = await runLoad(true);
        }

        set(function (s) {
          return {
            epg: s.epg,
            vod: s.vod,
            ads: s.ads,
            catchup: {
              status: 'ready',
              groups: payload.groupsWithEvents,
              recorded: payload.recorded,
              error: null,
              progress: { loadedGroups: payload.groupsWithEvents.length, totalGroups: payload.groupsWithEvents.length },
              lastLoadedAt: Date.now(),
            },
          };
        });
      } catch (err) {
        var catchupErrMsg = (err && err.message) || 'Error al cargar catchup';
        set(function (s) {
          var prev = s.catchup;
          var hasCachedData = (prev.groups && prev.groups.length > 0) || (prev.recorded && prev.recorded.length > 0);
          if (hasCachedData) return { epg: s.epg, vod: s.vod, ads: s.ads, catchup: { status: 'ready', error: null, groups: prev.groups, recorded: prev.recorded, progress: prev.progress, lastLoadedAt: prev.lastLoadedAt } };
          return { epg: s.epg, vod: s.vod, ads: s.ads, catchup: { status: 'error', error: catchupErrMsg, groups: prev.groups, recorded: prev.recorded, progress: prev.progress, lastLoadedAt: prev.lastLoadedAt } };
        });
      } finally {
        catchupLoading = false;
      }
    },

    resetPreload: function () {
      clearVodTimeout();
      vodLoading = false;
      adsLoading = false;
      catchupLoading = false;
      set(function () {
        return {
          epg: epgInitialState,
          vod: vodInitialState,
          ads: adsInitialState,
          catchup: catchupInitialState,
        };
      });
    },

    getStreamsWithEPG: function (channels) {
      var epg = get().epg;
      return mergeEpgIntoChannels(channels || [], epg.streams);
    },
  };
});

/** Selectores granulares: evitan re-renders al cambiar solo progreso EPG */
export const useEpgProgress = () => usePreloadStore((s) => s.epg.progress);
export const useEpgStatus = () => usePreloadStore((s) => s.epg.status);
export const useVodStatus = () => usePreloadStore((s) => s.vod.status);
export const useEpgError = () => usePreloadStore((s) => s.epg.error);
export const useVodError = () => usePreloadStore((s) => s.vod.error);
