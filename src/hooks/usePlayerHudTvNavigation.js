import { useEffect } from 'react';
import { TV_ACTION } from '../utils/tvRemote';
import { navigationRouter } from '../navigation/NavigationRouter';
import { focusElementSafe } from '../navigation/spatialNavigation';

export const PLAYER_HUD_SELECTOR = '[data-tv-nav="player-hud"]';
export const PLAYER_CHANNEL_SELECTOR = '[data-tv-nav="player-channel"]';
export const PLAYER_TRACK_SELECTOR = '[data-tv-nav="player-track"]';

export const PLAYER_FOCUS_IDS = Object.freeze({
  BACK: 'player-hud-back',
  EPG: 'player-hud-epg',
  LOCK: 'player-hud-lock',
  CHANNELS: 'player-hud-channels',
  INFO: 'player-hud-info',
  TRACKS: 'player-hud-tracks',
  REWIND: 'player-hud-rewind',
  PLAY: 'player-hud-play',
  FORWARD: 'player-hud-forward',
  GO_LIVE: 'player-hud-golive',
  OVERLAY_CLOSE: 'player-hud-overlay-close',
  TRACKS_CLOSE: 'player-hud-tracks-close',
});

const INITIAL_FOCUS_DELAY_MS = 280;

/**
 * Navegación TV (LRUD + BACK) para el `PlayerHud`.
 *
 * LEFT/RIGHT/UP/DOWN entre los botones del HUD (arriba-izquierda, arriba-centro,
 * abajo) ya no necesitan un modelo de "zonas" propio: son botones reales
 * posicionados en pantalla y el motor de geometría genérico (`NavigationRouter`)
 * los resuelve solo. Cada overlay (canales, pistas, info sin modal EPG/VOD, y
 * el overlay de error) atrapa su propio foco registrándose como zona de
 * `FocusManager` directamente en `PlayerHud.jsx` (push/pop/onBack) — igual que
 * cualquier otro modal ya migrado (ConfirmModal, EpgEventModal, etc).
 *
 * Lo que este hook conserva porque NO es navegación espacial genérica:
 *  - Foco inicial al aparecer el HUD (Reproducir si aplica, si no Volver).
 *  - "Despertar" el HUD oculto con cualquier tecla de navegación y colocar el
 *    foco en un punto seguro.
 *  - BACK sin overlay → cerrar el reproductor (cada overlay ya intercepta BACK
 *    él mismo vía su propia zona de FocusManager antes de que esto se ejecute).
 *  - Dejar pasar intacto el zapping por flechas (`channelChangeWithArrows`):
 *    mientras está activo, este hook NO debe mover el foco ni la geometría
 *    genérica debe correr para UP/DOWN — se marcan como "manejadas" sin hacer
 *    nada para que el listener dedicado de `usePlayerChannelZapping` (que sí
 *    corre, independiente de este router) sea el único que reaccione.
 */
export function usePlayerHudTvNavigation({
  isTV,
  hasContent,
  visible,
  hudRootRef,
  onWakeHud,
  onClosePlayer,
  showPlaybackButtons,
  channelChangeWithArrows = false,
  isLiveService = false,
  isPlaybackMaximized = false,
}) {
  useEffect(() => {
    if (!isTV || !hasContent) return undefined;

    const timer = setTimeout(() => {
      const root = hudRootRef?.current;
      if (!root) return;
      const active = document.activeElement;
      if (active && root.contains(active)) return;
      const play = document.getElementById(PLAYER_FOCUS_IDS.PLAY);
      const back = document.getElementById(PLAYER_FOCUS_IDS.BACK);
      if (showPlaybackButtons && play) {
        focusElementSafe(play);
      } else if (back) {
        focusElementSafe(back);
      }
    }, INITIAL_FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isTV, hasContent, showPlaybackButtons, hudRootRef]);

  useEffect(() => {
    if (!isTV || !hasContent) return undefined;

    const unregister = navigationRouter.register('global', (action) => {
      // Zapping por flechas: no tocar el foco, dejar que el listener dedicado
      // de usePlayerChannelZapping reaccione solo (nunca llama preventDefault
      // desde acá para no interferir con su propia lógica).
      const arrowZappingActive = channelChangeWithArrows && isLiveService && isPlaybackMaximized;
      if (arrowZappingActive && (action === TV_ACTION.UP || action === TV_ACTION.DOWN)) {
        return true;
      }

      if (action === TV_ACTION.BACK) {
        onClosePlayer?.();
        return true;
      }

      if (!visible) {
        if (
          action === TV_ACTION.UP ||
          action === TV_ACTION.DOWN ||
          action === TV_ACTION.LEFT ||
          action === TV_ACTION.RIGHT ||
          action === TV_ACTION.ENTER
        ) {
          onWakeHud?.();
          const first =
            (showPlaybackButtons && document.getElementById(PLAYER_FOCUS_IDS.PLAY)) ||
            document.getElementById(PLAYER_FOCUS_IDS.BACK);
          focusElementSafe(first);
          return true;
        }
        return false;
      }

      // HUD visible, sin overlay: el motor de geometría genérico resuelve
      // LEFT/RIGHT/UP/DOWN entre los botones reales del HUD.
      return false;
    });

    return unregister;
  }, [
    isTV,
    hasContent,
    visible,
    onWakeHud,
    onClosePlayer,
    showPlaybackButtons,
    channelChangeWithArrows,
    isLiveService,
    isPlaybackMaximized,
  ]);
}

export default usePlayerHudTvNavigation;
