import { useCallback, useEffect } from 'react';
import { findZappingChannelIndex } from '../utils/channelZappingList';
import { TV_ACTION } from '../utils/tvRemote';
import { navigationRouter } from '../navigation/NavigationRouter';

/**
 * Zapping en vivo (paridad 10foot, sin excepción fotelka en flechas).
 *
 * - CH+ / CH−: siempre con live y reproductor maximizado (como scene.js PUP/PDOWN).
 * - ↑/↓: solo si `arrowKeysEnabled` (player.channelChangeWithArrows).
 * - channelUp → +1 en lista; channelDown → −1 (LCN ascendente, lcn 0 al final).
 *
 * Se registra como handler de zona 'global' en `NavigationRouter` en vez de
 * instalar su propio `window.addEventListener('keydown')` — antes este hook,
 * `usePlayerHudTvNavigation` y el router central competían por la misma tecla
 * con un `stopImmediatePropagation()` propio que dependía del orden de montaje
 * para "ganarle" a los demás. Ahora hay un único listener de `keydown` en toda
 * la app; este hook solo aporta un handler más a la cola de esa zona.
 */
export function usePlayerChannelZapping({
  arrowKeysEnabled = false,
  channelKeysEnabled = true,
  isLiveService,
  isPlaybackMaximized,
  overlay,
  channels,
  currentServiceId,
  onZapToChannel,
  onWakeHud,
}) {
  const zapByDirection = useCallback(
    (direction) => {
      const list = Array.isArray(channels) ? channels : [];
      if (!isLiveService || !isPlaybackMaximized || list.length === 0) return;

      const idx = findZappingChannelIndex(list, currentServiceId);
      if (idx < 0) return;

      // 10foot: channelUp(+1), channelDown(-1)
      const delta = direction === 'up' ? 1 : -1;
      let nextIdx = idx + delta;
      if (nextIdx < 0) nextIdx = list.length - 1;
      if (nextIdx >= list.length) nextIdx = 0;

      const next = list[nextIdx];
      if (!next) return;
      onZapToChannel?.(next);
      onWakeHud?.();
    },
    [
      isLiveService,
      isPlaybackMaximized,
      channels,
      currentServiceId,
      onZapToChannel,
      onWakeHud,
    ],
  );

  useEffect(() => {
    const canZap =
      isLiveService &&
      isPlaybackMaximized &&
      (arrowKeysEnabled || channelKeysEnabled);
    if (!canZap) return undefined;

    // Handler de zona: `NavigationRouter` ya filtró altKey/ctrlKey/metaKey y
    // resolvió `action` antes de invocar esto. Retornar `true` consume la
    // tecla (el router hace preventDefault/stopPropagation por nosotros);
    // `false` la deja pasar sin necesidad de stopImmediatePropagation.
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

      let direction = null;
      if (channelKeysEnabled && action === TV_ACTION.CHANNEL_UP) {
        direction = 'up';
      } else if (channelKeysEnabled && action === TV_ACTION.CHANNEL_DOWN) {
        direction = 'down';
      } else if (arrowKeysEnabled && action === TV_ACTION.UP) {
        direction = 'up';
      } else if (arrowKeysEnabled && action === TV_ACTION.DOWN) {
        direction = 'down';
      }

      if (!direction) return false;
      zapByDirection(direction);
      return true;
    };

    return navigationRouter.register('global', handler);
  }, [
    arrowKeysEnabled,
    channelKeysEnabled,
    isLiveService,
    isPlaybackMaximized,
    overlay,
    zapByDirection,
  ]);

  return { zapByDirection };
}

export default usePlayerChannelZapping;
