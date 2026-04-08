import { create } from 'zustand';
import { useParentalStore } from './parentalStore';
import { getChannelStableId } from '../utils/channelId';

const initial = {
  open: false,
  channel: null,
  playFn: null,
  title: '',
  message: '',
  purpose: 'playback', // 'playback' | 'action'
  unlockScope: 'channel', // 'channel' | 'global'
  lastFocusedEl: null,
};

export const useParentalGateStore = create((set, get) => ({
  ...initial,

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

    // Evitar lockout: si no hay PIN configurado, dejar pasar (la UI de settings fuerza el setPin).
    if (!parental.hasPinConfigured?.()) {
      playFn();
      return true;
    }

    // Acciones administrativas (p.ej. desbloquear en settings) deben pedir PIN SIEMPRE
    // cuando control parental está activo y hay PIN, aunque exista unlock temporal vigente.
    if (purpose === 'action') {
      set({
        open: true,
        channel,
        playFn,
        title: typeof title === 'string' ? title : '',
        message: typeof message === 'string' ? message : '',
        purpose: 'action',
        unlockScope: unlockScope === 'global' ? 'global' : 'channel',
        lastFocusedEl: document.activeElement,
      });
      return true;
    }

    const blocked = parental.isChannelBlocked?.(channelId) === true;
    const unlocked = parental.isUnlockedFor?.(channelId) === true;

    if (!blocked || unlocked) {
      playFn();
      return true;
    }

    set({
      open: true,
      channel,
      playFn,
      title: typeof title === 'string' ? title : '',
      message: typeof message === 'string' ? message : '',
      purpose: purpose === 'action' ? 'action' : 'playback',
      unlockScope: unlockScope === 'global' ? 'global' : 'channel',
      lastFocusedEl: document.activeElement,
    });
    return true;
  },

  submitPin: async (pin) => {
    const { channel, playFn, purpose, unlockScope } = get();
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

    // Playback: desbloqueo temporal por CANAL (default) para no abrir todos los bloqueados.
    const ok = await parental.unlockWithPin?.(pin, {
      scope: unlockScope === 'global' ? 'global' : 'channel',
      channelId,
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

