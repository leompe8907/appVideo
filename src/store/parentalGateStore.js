import { create } from 'zustand';
import { useParentalStore } from './parentalStore';
import { usePreloadStore } from './preloadStore';
import { getChannelStableId } from '../utils/channelId';
import { normalizeBrParentalRating } from '../utils/parentalRatingBR';
import { getCurrentEpgEvent } from '../utils/epgCurrentEvent';
import i18n from '../locales/i18n';
import { getActiveBrandConfig } from '../config/brandConfig';

const initial = {
  open: false,
  channel: null,
  playFn: null,
  title: '',
  message: '',
  gateKind: 'channel', // 'channel' | 'rating' | 'parentalControl' | 'setupPin'
  purpose: 'playback', // 'playback' | 'action'
  unlockScope: 'channel', // 'channel' | 'global'
  pcUnlockMode: null, // 'session' | 'ttl' | null
  pcUnlockTtlMs: null,
  lastFocusedEl: null,
};

function boolish(v) {
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

function getParentalControlFlag(channel) {
  return boolish(channel?.parentalControl ?? channel?.parental_control ?? false);
}

function getAdultCountInBouquet(channel) {
  const preload = usePreloadStore.getState();
  const bouquets = preload?.epg?.bouquetsWithChannels || [];
  if (!Array.isArray(bouquets) || bouquets.length === 0) return 0;

  const targetId = getChannelStableId(channel);
  if (!targetId) return 0;

  const bouquet = bouquets.find((b) => {
    const items = b?.items || b?.channels || [];
    if (!Array.isArray(items) || items.length === 0) return false;
    return items.some((it) => getChannelStableId(it) === targetId);
  });
  const items = bouquet?.items || bouquet?.channels || [];
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.filter((it) => getParentalControlFlag(it)).length;
}

export const useParentalGateStore = create((set, get) => ({
  ...initial,

  requestSetupPin: ({ title, message, channel } = {}) => {
    set({
      open: true,
      channel: channel || null,
      playFn: null,
      title: typeof title === 'string' ? title : '',
      message: typeof message === 'string' ? message : '',
      gateKind: 'setupPin',
      purpose: 'action',
      unlockScope: 'global',
      lastFocusedEl: document.activeElement,
    });
    return true;
  },

  closeGate: () => {
    const el = get().lastFocusedEl;
    set({ ...initial });
    if (el && typeof el.focus === 'function') {
      try {
        el.focus({ preventScroll: true });
      } catch {
        // noop
      }
    }
  },

  requestPlayChannel: ({ channel, playFn, title, message, purpose, unlockScope }) => {
    if (!channel || typeof playFn !== 'function') return false;
    const channelId = getChannelStableId(channel);

    const parental = useParentalStore.getState();
    if (!parental.enabled) {
      playFn();
      return true;
    }

    // Si no hay PIN configurado, NO permitir reproducir contenido bloqueado:
    // guiar al usuario a configurar el PIN primero.
    const hasPin = parental.hasPinConfigured?.() === true;

    // Acciones administrativas (p.ej. desbloquear en settings) deben pedir PIN SIEMPRE
    // cuando control parental está activo y hay PIN, aunque exista unlock temporal vigente.
    if (purpose === 'action') {
      if (!hasPin) {
        return get().requestSetupPin({
          channel,
          title: typeof title === 'string' && title ? title : i18n.t('parental.title', { defaultValue: 'Control parental' }),
          message:
            typeof message === 'string' && message
              ? message
              : i18n.t('parental.setupPinMessage', {
                  defaultValue: 'Para usar el control parental debes configurar un PIN.',
                }),
        });
      }
      set({
        open: true,
        channel,
        playFn,
        title: typeof title === 'string' ? title : '',
        message: typeof message === 'string' ? message : '',
        gateKind: 'channel',
        purpose: 'action',
        unlockScope: unlockScope === 'global' ? 'global' : 'channel',
        lastFocusedEl: document.activeElement,
      });
      return true;
    }

    const blocked = parental.isChannelBlocked?.(channelId) === true;
    const unlocked = parental.isUnlockedFor?.(channelId) === true;

    // 1) Si el canal está bloqueado, aplicar gate por canal.
    if (blocked && !unlocked) {
      if (!hasPin) {
        return get().requestSetupPin({
          channel,
          title: i18n.t('parental.title', { defaultValue: 'Control parental' }),
          message: i18n.t('parental.setupPinMessage', {
            defaultValue: 'Para usar el control parental debes configurar un PIN.',
          }),
        });
      }
      set({
        open: true,
        channel,
        playFn,
        title: typeof title === 'string' ? title : '',
        message: typeof message === 'string' ? message : '',
        gateKind: 'channel',
        purpose: 'playback',
        unlockScope: unlockScope === 'global' ? 'global' : 'channel',
        lastFocusedEl: document.activeElement,
      });
      return true;
    }

    // 2) parentalControl:true (adultos) - gate por metadata.
    // Regla:
    // - Si el bouquet tiene 1 solo canal adulto -> unlock de sesión (sin TTL), se invalida al entrar a un canal no-adulto.
    // - Si el bouquet tiene 2+ canales adultos -> unlock global con TTL configurable por marca, se invalida al entrar a un canal no-adulto.
    const isAdult = getParentalControlFlag(channel);
    if (isAdult) {
      const pcUnlocked = parental.isParentalControlUnlocked?.() === true;
      if (!pcUnlocked) {
        const adultCount = getAdultCountInBouquet(channel);
        const mode = adultCount >= 2 ? 'ttl' : 'session';
        const brandCfg = getActiveBrandConfig?.();
        const ttlMs = Number(
          brandCfg?.parental?.parentalControlMultiTtlMs ?? 40 * 60 * 1000
        );
        set({
          open: true,
          channel,
          playFn,
          title: typeof title === 'string' && title ? title : i18n.t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
          message:
            typeof message === 'string' && message
              ? message
              : i18n.t('parental.parentalControlMessage', {
                  defaultValue: 'Ingresa el PIN para reproducir contenido restringido.',
                }),
          gateKind: 'parentalControl',
          purpose: 'playback',
          unlockScope: 'global',
          pcUnlockMode: mode,
          pcUnlockTtlMs: mode === 'ttl' ? (Number.isFinite(ttlMs) ? ttlMs : 40 * 60 * 1000) : null,
          lastFocusedEl: document.activeElement,
        });
        return true;
      }
    } else {
      // Seguridad/coherencia: al reproducir contenido no-adulto invalidamos unlock "adulto".
      try {
        parental.invalidateParentalControlUnlock?.();
      } catch {
        // noop
      }
    }

    // 3) Si no está bloqueado por canal, evaluar gate por rating (si está habilitado).
    if (parental.ratingEnabled === true && parental.ratingApplyToLive !== false) {
      const rawFromChannel = channel?.parentalRating ?? channel?.parental_rating ?? null;
      const currentEvent = getCurrentEpgEvent(channel?.epgItems || []);
      const rawFromEvent = currentEvent?.parentalRating ?? currentEvent?.parental_rating ?? null;
      const rating = normalizeBrParentalRating(rawFromEvent ?? rawFromChannel);
      const allowedMax = Number(parental.ratingAllowedMax ?? 18);
      const ratingUnlocked = parental.isRatingUnlocked?.() === true;

      if (!ratingUnlocked && rating != null && rating > allowedMax) {
        set({
          open: true,
          channel,
          playFn,
          title: i18n.t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
          message: i18n.t('parental.restrictedMessage', {
            defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.',
          }),
          gateKind: 'rating',
          purpose: 'playback',
          unlockScope: 'global',
          lastFocusedEl: document.activeElement,
        });
        return true;
      }
    }

    playFn();
    return true;
  },

  requestPlayMedia: ({ item, ratingRaw, playFn, title, message }) => {
    if (!item || typeof playFn !== 'function') return false;
    const parental = useParentalStore.getState();
    if (!parental.enabled) {
      playFn();
      return true;
    }
    if (!parental.hasPinConfigured?.()) {
      playFn();
      return true;
    }

    if (parental.ratingEnabled !== true) {
      playFn();
      return true;
    }

    const rating = normalizeBrParentalRating(
      ratingRaw ?? item?.parentalRating ?? item?.parental_rating ?? null
    );
    const allowedMax = Number(parental.ratingAllowedMax ?? 18);
    const ratingUnlocked = parental.isRatingUnlocked?.() === true;

    if (!ratingUnlocked && rating != null && rating > allowedMax) {
      set({
        open: true,
        channel: item,
        playFn,
        title:
          typeof title === 'string' && title
            ? title
            : i18n.t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
        message:
          typeof message === 'string' && message
            ? message
            : i18n.t('parental.restrictedMessage', {
                defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.',
              }),
        gateKind: 'rating',
        purpose: 'playback',
        unlockScope: 'global',
        lastFocusedEl: document.activeElement,
      });
      return true;
    }

    playFn();
    return true;
  },

  submitPin: async (pin) => {
    const { channel, playFn, purpose, unlockScope, gateKind, pcUnlockMode, pcUnlockTtlMs } = get();
    const parental = useParentalStore.getState();
    const channelId = getChannelStableId(channel);

    // Si el PIN se pide para una acción administrativa (p.ej. desbloquear canal en settings),
    // validamos el PIN sin habilitar unlock temporal.
    if (purpose === 'action') {
      const ok = await parental.verifyPin?.(pin);
      if (!ok) return false;
      get().closeGate();
      try {
        playFn?.();
      } catch {
        // noop
      }
      return true;
    }

    // Playback:
    // - canal bloqueado: unlock por canal (default)
    // - rating: unlock temporal global por TTL
    const ok = await (async () => {
      if (gateKind === 'rating') return parental.unlockRatingWithPin?.(pin);
      if (gateKind === 'parentalControl') {
        return parental.unlockParentalControlWithPin?.(pin, {
          mode: pcUnlockMode === 'session' ? 'session' : 'ttl',
          ttlMs: pcUnlockTtlMs,
        });
      }
      return parental.unlockWithPin?.(pin, {
        scope: unlockScope === 'global' ? 'global' : 'channel',
        channelId,
      });
    })();
    if (!ok) return false;
    // cerrar antes de reproducir para restaurar foco/UI limpia
    get().closeGate();
    try {
      playFn?.();
    } catch {
      // noop
    }
    return true;
  },
}));

export default useParentalGateStore;

