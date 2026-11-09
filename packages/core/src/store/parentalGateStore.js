import { create } from 'zustand';
import { useParentalStore } from './parentalStore';
import { useActiveProfileStore } from './activeProfileStore';
import { getChannelStableId } from '../utils/channelId';
import { normalizeBrParentalRating } from '../utils/parentalRatingBR';
import { getCurrentEpgEvent } from '../utils/epgCurrentEvent';
import i18n from '../locales/i18n';
import { getActiveBrandConfig, isParentalControlEnabledForBrand } from '../config/brandConfig';

/**
 * Cómo guardar y devolver el foco al abrir/cerrar el gate. Cada plataforma
 * registra el suyo (la web: `registerParentalGateWebFocus`); sin registrar,
 * no se toca el foco.
 */
let focusAdapter = {
  capture: () => null,
  restore: (el) => {
    if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
  },
};

/** @param {{ capture?: () => any, restore?: (snapshot: any) => void }} adapter */
export function setParentalGateFocusAdapter(adapter) {
  focusAdapter = { ...focusAdapter, ...(adapter || {}) };
}

function captureGateFocusSnapshot() {
  try {
    return focusAdapter.capture();
  } catch {
    return null;
  }
}

const initial = {
  open: false,
  channel: null,
  playFn: null,
  title: '',
  message: '',
  gateKind: 'channel', // 'channel' | 'rating' | 'parentalControl' | 'setupPin' | 'profileAge'
  purpose: 'playback', // 'playback' | 'action'
  lastFocusedEl: null,
};

/**
 * Edad máxima del perfil externo activo (`null` = sin límite). Va antes que el
 * control parental de la app y no se desbloquea con PIN: para ver ese
 * contenido hay que cambiar de perfil. Sin clasificación cuenta como apto,
 * salvo el contenido marcado para adultos (`parentalControl`), que es 18.
 */
function profileMaxAge() {
  const profile = useActiveProfileStore.getState();
  return profile?.source === 'externo' && Number.isFinite(profile.maxAge) ? profile.maxAge : null;
}

function exceedsProfileAge(rating, isAdult) {
  const maxAge = profileMaxAge();
  if (maxAge == null) return false;
  const effective = isAdult ? 18 : rating;
  return effective != null && effective > maxAge;
}

function boolish(v) {
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

function getParentalControlFlag(channel) {
  return boolish(channel?.parentalControl ?? channel?.parental_control ?? false);
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
      lastFocusedEl: captureGateFocusSnapshot(),
    });
    return true;
  },

  closeGate: () => {
    const el = get().lastFocusedEl;
    set({ ...initial });
    if (el) {
      try {
        focusAdapter.restore(el);
      } catch {
        // noop
      }
    }
  },

  requestProfileAgeBlock: ({ channel } = {}) => {
    const name = useActiveProfileStore.getState()?.name || '';
    set({
      open: true,
      channel: channel || null,
      playFn: null,
      title: i18n.t('profile.ageBlockedTitle', { defaultValue: 'No disponible en este perfil' }),
      message: i18n.t('profile.ageBlockedMessage', {
        name,
        defaultValue: 'Este contenido supera la edad permitida para el perfil {{name}}. Cambia de perfil para verlo.',
      }),
      gateKind: 'profileAge',
      purpose: 'playback',
      lastFocusedEl: captureGateFocusSnapshot(),
    });
    return true;
  },

  requestPlayChannel: ({ channel, playFn, title, message, purpose }) => {
    if (!channel || typeof playFn !== 'function') return false;
    const channelId = getChannelStableId(channel);

    if (purpose !== 'action') {
      const currentEvent = getCurrentEpgEvent(channel?.epgItems || []);
      const rating = normalizeBrParentalRating(
        currentEvent?.parentalRating ?? currentEvent?.parental_rating
          ?? channel?.parentalRating ?? channel?.parental_rating ?? null
      );
      if (exceedsProfileAge(rating, getParentalControlFlag(channel))) {
        return get().requestProfileAgeBlock({ channel });
      }
    }

    // Si la marca no tiene el flag `account.sections.parentalControl`, la
    // funcionalidad completa (bloqueo por canal, contenido adulto, rating)
    // queda inerte para esta marca -- nunca se abre el modal de PIN, sin
    // importar el estado guardado de `parental.enabled`/canales bloqueados.
    if (!isParentalControlEnabledForBrand(getActiveBrandConfig())) {
      playFn();
      return true;
    }

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
        lastFocusedEl: captureGateFocusSnapshot(),
      });
      return true;
    }

    // Un PIN vigente abre todo lo restringido (bloqueados, adultos y rating)
    // hasta que vence. Al vencer no se corta lo que se está viendo: el gate
    // solo actúa al pedir reproducir, así que el próximo cambio vuelve a pedirlo.
    if (parental.isUnlocked?.() === true) {
      playFn();
      return true;
    }

    // 1) Si el canal está bloqueado, aplicar gate por canal.
    if (parental.isChannelBlocked?.(channelId) === true) {
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
        lastFocusedEl: captureGateFocusSnapshot(),
      });
      return true;
    }

    // 2) parentalControl:true (adultos) - gate por metadata.
    if (getParentalControlFlag(channel)) {
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
        lastFocusedEl: captureGateFocusSnapshot(),
      });
      return true;
    }

    // 3) Si no está bloqueado por canal, evaluar gate por rating (si está habilitado).
    if (parental.ratingEnabled === true && parental.ratingApplyToLive !== false) {
      const rawFromChannel = channel?.parentalRating ?? channel?.parental_rating ?? null;
      const currentEvent = getCurrentEpgEvent(channel?.epgItems || []);
      const rawFromEvent = currentEvent?.parentalRating ?? currentEvent?.parental_rating ?? null;
      const rating = normalizeBrParentalRating(rawFromEvent ?? rawFromChannel);
      const allowedMax = Number(parental.ratingAllowedMax ?? 18);

      if (rating != null && rating > allowedMax) {
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
          lastFocusedEl: captureGateFocusSnapshot(),
        });
        return true;
      }
    }

    playFn();
    return true;
  },

  requestPlayMedia: ({ item, ratingRaw, playFn, title, message }) => {
    if (!item || typeof playFn !== 'function') return false;

    const mediaRating = normalizeBrParentalRating(
      ratingRaw ?? item?.parentalRating ?? item?.parental_rating ?? null
    );
    if (exceedsProfileAge(mediaRating, getParentalControlFlag(item))) {
      return get().requestProfileAgeBlock({ channel: item });
    }

    if (!isParentalControlEnabledForBrand(getActiveBrandConfig())) {
      playFn();
      return true;
    }

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

    if (parental.isUnlocked?.() !== true && rating != null && rating > allowedMax) {
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
          lastFocusedEl: captureGateFocusSnapshot(),
      });
      return true;
    }

    playFn();
    return true;
  },

  submitPin: async (pin) => {
    const { playFn, purpose, gateKind } = get();
    // La edad del perfil externo no se desbloquea con ningún PIN.
    if (gateKind === 'profileAge') return false;
    const parental = useParentalStore.getState();

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

    // Playback (canal bloqueado, adulto o rating): un solo desbloqueo que abre
    // todo durante el TTL de la marca; inválido o <= 0 -> default del store.
    const ttlMs = Number(getActiveBrandConfig?.()?.parental?.channelUnlockTtlMs);
    const ok = await parental.unlockWithPin?.(pin, {
      ttlMs: Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : undefined,
    });
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

