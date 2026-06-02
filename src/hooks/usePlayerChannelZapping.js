import { useCallback, useEffect } from 'react';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';

function findChannelIndex(channels, currentId, currentLcn) {
  if (!Array.isArray(channels) || channels.length === 0) return -1;
  const idStr = currentId != null ? String(currentId) : '';
  const lcnStr = currentLcn != null ? String(currentLcn) : '';
  const idx = channels.findIndex((ch) => {
    const chId = ch?.id != null ? String(ch.id) : '';
    const chLcn = ch?.lcn != null ? String(ch.lcn) : '';
    if (idStr && (chId === idStr || chLcn === idStr)) return true;
    if (lcnStr && (chLcn === lcnStr || chId === lcnStr)) return true;
    return false;
  });
  return idx >= 0 ? idx : 0;
}

/**
 * Zapping de canal en vivo con ↑/↓ (mando TV y teclado).
 * Requiere `player.channelChangeWithArrows === true` en la marca activa.
 */
export function usePlayerChannelZapping({
  enabled,
  isLiveService,
  hasContent,
  overlay,
  channels,
  currentChannelId,
  currentChannelLcn,
  onZapToChannel,
  onWakeHud,
}) {
  const zapByDirection = useCallback(
    (direction) => {
      const list = Array.isArray(channels) ? channels : [];
      if (!enabled || !isLiveService || list.length === 0) return;

      const idx = findChannelIndex(list, currentChannelId, currentChannelLcn);
      const delta = direction === 'down' ? 1 : -1;
      let nextIdx = idx + delta;
      if (nextIdx < 0) nextIdx = list.length - 1;
      if (nextIdx >= list.length) nextIdx = 0;

      const next = list[nextIdx];
      if (!next) return;
      onZapToChannel?.(next);
      onWakeHud?.();
    },
    [
      enabled,
      isLiveService,
      channels,
      currentChannelId,
      currentChannelLcn,
      onZapToChannel,
      onWakeHud,
    ]
  );

  useEffect(() => {
    if (!enabled || !hasContent || !isLiveService) return undefined;

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
      if (action !== TV_ACTION.UP && action !== TV_ACTION.DOWN) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      zapByDirection(action === TV_ACTION.DOWN ? 'down' : 'up');
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled, hasContent, isLiveService, overlay, zapByDirection]);

  return { zapByDirection };
}

export default usePlayerChannelZapping;
