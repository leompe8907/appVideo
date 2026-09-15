import { useEffect } from 'react';
import { TV_ACTION } from '../utils/tvRemote';
import { navigationRouter } from '../navigation/NavigationRouter';

const VOLUME_STEP = 0.1;

/**
 * Volumen con ↑/↓ del teclado -- solo PC (ver PlayerHud.jsx: se activa con
 * `!isTV && features.playerVolumeControls`, el mismo flag de marca que ya
 * gatea el botón de mute + slider del HUD, ver `playerVolumePreference.js`).
 *
 * En PC las flechas ↑/↓ quedan libres para esto porque el zapping de canal
 * por flecha en PC usa ←/→ (ver `usePlayerChannelZapping.js`,
 * `horizontalArrowKeysEnabled`) -- en TV sigue siendo al revés (↑/↓ zapea,
 * no hay volumen de app que subir/bajar porque los engines de TV no
 * implementan setVolume/mute), así que este hook ni se registra ahí.
 */
export function usePlayerVolumeKeys({ enabled = false, overlay, volume, muted, setVolume, onWakeHud }) {
  useEffect(() => {
    if (!enabled) return undefined;

    // Handler de zona: mismo contrato que el resto de los handlers de
    // `NavigationRouter` (true = consumida, false = se deja pasar).
    const handler = (action) => {
      if (overlay) return false;

      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return false;
      }

      if (action !== TV_ACTION.UP && action !== TV_ACTION.DOWN) return false;

      // Si estaba muteado, subir/bajar desde 0 (no desde el volumen previo a
      // mutear) -- mismo criterio que ya usa el slider del HUD.
      const current = muted ? 0 : Number.isFinite(volume) ? volume : 1;
      const delta = action === TV_ACTION.UP ? VOLUME_STEP : -VOLUME_STEP;
      const next = Math.min(1, Math.max(0, current + delta));
      setVolume(next);
      onWakeHud?.();
      return true;
    };

    return navigationRouter.register('global', handler);
  }, [enabled, overlay, volume, muted, setVolume, onWakeHud]);
}

export default usePlayerVolumeKeys;
