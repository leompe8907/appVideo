import { useCallback, useEffect } from 'react';
import { findZappingChannelIndex } from '../utils/channelZappingList';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';

/**
 * Zapping en vivo (paridad 10foot, sin excepción fotelka en flechas).
 *
 * - CH+ / CH−: siempre con live y reproductor maximizado (como scene.js PUP/PDOWN).
 * - ↑/↓: solo si `arrowKeysEnabled` (player.channelChangeWithArrows).
 * - channelUp → +1 en lista; channelDown → −1 (LCN ascendente, lcn 0 al final).
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

    const onKeyDown = (e) => {
      if (overlay) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }

      const action = getTvActionFromKeyEvent(e);
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

      if (!direction) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      zapByDirection(direction);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
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
