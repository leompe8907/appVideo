import { useEffect, useRef } from 'react';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import {
  findFocusableElements,
  focusById,
  focusElement,
  focusNextElementInList,
} from '../utils/tvNavigation';
import { scrollElementIntoVisibleScrollAncestors } from '../utils/homeShellNavigation';

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

const ZONE_TOP_LEFT = 'player-top-left';
const ZONE_TOP_CENTER = 'player-top-center';
const ZONE_BOTTOM = 'player-bottom-actions';

const INITIAL_FOCUS_DELAY_MS = 280;
const OVERLAY_FOCUS_DELAY_MS = 120;

function queryZoneButtons(root, zone) {
  if (!(root instanceof HTMLElement)) return [];
  const zoneEl = root.querySelector(`[data-tv-nav-zone="${zone}"]`);
  if (!zoneEl) return [];
  return findFocusableElements(zoneEl, PLAYER_HUD_SELECTOR);
}

function focusHorizontalInZone(zoneButtons, current, direction) {
  if (!zoneButtons.length) return null;
  const delta = direction === TV_ACTION.LEFT ? -1 : 1;
  const fromIdx = zoneButtons.indexOf(current);
  let i = fromIdx >= 0 ? fromIdx + delta : delta > 0 ? 0 : zoneButtons.length - 1;
  while (i >= 0 && i < zoneButtons.length) {
    if (focusElement(zoneButtons[i])) return zoneButtons[i];
    i += delta;
  }
  return null;
}

function getTracksSections() {
  const popover = document.querySelector('.player-hud__tracks-popover');
  if (!popover) return { audio: [], subs: [], closeBtn: null };
  const sections = [...popover.querySelectorAll('.player-hud__tracks-section')];
  const audio = sections[0]
    ? findFocusableElements(sections[0].querySelector('.player-hud__tracks-list'), PLAYER_TRACK_SELECTOR)
    : [];
  const subs = sections[1]
    ? findFocusableElements(sections[1].querySelector('.player-hud__tracks-list'), PLAYER_TRACK_SELECTOR)
    : [];
  const closeBtn = popover.querySelector(`#${PLAYER_FOCUS_IDS.TRACKS_CLOSE}`);
  return { audio, subs, closeBtn };
}

function scrollChannelRowIntoView(row) {
  const list = row?.closest?.('.player-channel-sidebar__list');
  if (list instanceof HTMLElement && row instanceof HTMLElement) {
    scrollElementIntoVisibleScrollAncestors(row, list);
  }
}

/**
 * Navegación TV (LRUD + BACK + ENTER) para controles del PlayerHud.
 */
export function usePlayerHudTvNavigation({
  isTV,
  hasContent,
  visible,
  overlay,
  hudRootRef,
  onWakeHud,
  onClosePlayerOverlay,
  onClosePlayer,
  showPlaybackButtons,
  channelChangeWithArrows = false,
  isLiveService = false,
  isPlaybackMaximized = false,
}) {
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  useEffect(() => {
    if (!isTV || !hasContent) return undefined;

    const timer = setTimeout(() => {
      if (overlayRef.current) return;
      const root = hudRootRef?.current;
      if (!root) return;
      const active = document.activeElement;
      if (active && root.contains(active)) return;
      const play = document.getElementById(PLAYER_FOCUS_IDS.PLAY);
      const back = document.getElementById(PLAYER_FOCUS_IDS.BACK);
      if (showPlaybackButtons && play) {
        focusElement(play);
      } else if (back) {
        focusElement(back);
      }
    }, INITIAL_FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isTV, hasContent, showPlaybackButtons, hudRootRef]);

  useEffect(() => {
    if (!isTV || !hasContent || !overlay) return undefined;

    const timer = setTimeout(() => {
      if (overlay === 'channels') {
        const list = document.querySelector('.player-channel-sidebar__list');
        const items = findFocusableElements(list, PLAYER_CHANNEL_SELECTOR);
        if (items[0]) {
          focusElement(items[0]);
          scrollChannelRowIntoView(items[0]);
        }
        return;
      }
      if (overlay === 'tracks') {
        const { audio } = getTracksSections();
        if (audio[0]) {
          focusElement(audio[0]);
          return;
        }
        focusById(PLAYER_FOCUS_IDS.TRACKS_CLOSE);
        return;
      }
      if (
        overlay === 'info' &&
        (document.getElementById('epg-event-close') || document.getElementById('player-vod-info-close'))
      ) {
        return;
      }
      focusById(PLAYER_FOCUS_IDS.OVERLAY_CLOSE);
    }, OVERLAY_FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isTV, hasContent, overlay]);

  useEffect(() => {
    if (!isTV || !hasContent) return undefined;

    const onFocusIn = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches(PLAYER_CHANNEL_SELECTOR)) {
        scrollChannelRowIntoView(t);
      }
    };

    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, [isTV, hasContent]);

  useEffect(() => {
    if (!isTV || !hasContent) return undefined;

    const handleHudNav = (action, e, root) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !root.contains(active)) {
        onWakeHud?.();
        const first =
          (showPlaybackButtons && document.getElementById(PLAYER_FOCUS_IDS.PLAY)) ||
          document.getElementById(PLAYER_FOCUS_IDS.BACK);
        if (first) {
          e.preventDefault();
          e.stopPropagation();
          focusElement(first);
        }
        return;
      }

      const topLeft = queryZoneButtons(root, ZONE_TOP_LEFT);
      const topCenter = queryZoneButtons(root, ZONE_TOP_CENTER);
      const bottom = queryZoneButtons(root, ZONE_BOTTOM);

      const inTopLeft = topLeft.includes(active);
      const inTopCenter = topCenter.includes(active);
      const inBottom = bottom.includes(active);

      if (action === TV_ACTION.LEFT || action === TV_ACTION.RIGHT) {
        let moved = null;
        if (inTopLeft) {
          moved = focusHorizontalInZone(topLeft, active, action);
          if (!moved && action === TV_ACTION.RIGHT) {
            if (topCenter.length) moved = focusElement(topCenter[0]) ? topCenter[0] : null;
            else if (bottom.length) moved = focusElement(bottom[0]) ? bottom[0] : null;
          }
        } else if (inTopCenter) {
          moved = focusHorizontalInZone(topCenter, active, action);
          if (!moved && action === TV_ACTION.LEFT && topLeft.length) {
            moved = focusElement(topLeft[topLeft.length - 1]) ? topLeft[topLeft.length - 1] : null;
          }
          if (!moved && action === TV_ACTION.RIGHT && bottom.length) {
            moved = focusElement(bottom[0]) ? bottom[0] : null;
          }
        } else if (inBottom) {
          moved = focusHorizontalInZone(bottom, active, action);
          if (!moved && action === TV_ACTION.LEFT) {
            if (topCenter.length) moved = focusElement(topCenter[topCenter.length - 1]) ? topCenter[topCenter.length - 1] : null;
            else if (topLeft.length) moved = focusElement(topLeft[topLeft.length - 1]) ? topLeft[topLeft.length - 1] : null;
          }
        }
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (action === TV_ACTION.DOWN) {
        let target = null;
        if (inTopLeft || inTopCenter) {
          if (bottom.length) target = bottom[0];
          else if (inTopLeft && topCenter.length) target = topCenter[0];
        }
        if (target && focusElement(target)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (action === TV_ACTION.UP) {
        let target = null;
        if (inBottom) {
          if (topCenter.length) target = topCenter[Math.min(1, topCenter.length - 1)];
          else if (topLeft.length) target = topLeft[0];
        } else if (inTopCenter) {
          if (topLeft.length) target = topLeft[0];
        } else if (inTopLeft && topCenter.length) {
          target = topCenter[0];
        }
        if (target && focusElement(target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const handleChannelsNav = (action, e) => {
      const list = document.querySelector('.player-channel-sidebar__list');
      const items = findFocusableElements(list, PLAYER_CHANNEL_SELECTOR);
      const active = document.activeElement;

      if (action === TV_ACTION.BACK) {
        e.preventDefault();
        e.stopPropagation();
        onClosePlayerOverlay?.();
        return;
      }

      if (action === TV_ACTION.UP || action === TV_ACTION.DOWN) {
        const moved =
          active instanceof HTMLElement
            ? focusNextElementInList(active, items, action === TV_ACTION.UP ? 'up' : 'down')
            : items[0] && focusElement(items[0])
              ? items[0]
              : null;
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          scrollChannelRowIntoView(moved);
        } else if (items[0]) {
          e.preventDefault();
          e.stopPropagation();
          focusElement(items[0]);
          scrollChannelRowIntoView(items[0]);
        }
      }
    };

    const handleTracksNav = (action, e) => {
      const { audio, subs, closeBtn } = getTracksSections();
      const active = document.activeElement;
      const inAudio = active instanceof HTMLElement && audio.includes(active);
      const inSubs = active instanceof HTMLElement && subs.includes(active);
      const onClose = active === closeBtn;

      if (action === TV_ACTION.BACK) {
        e.preventDefault();
        e.stopPropagation();
        onClosePlayerOverlay?.();
        return;
      }

      if (action === TV_ACTION.UP || action === TV_ACTION.DOWN) {
        let list = inAudio ? audio : inSubs ? subs : audio.length ? audio : subs;
        let moved = null;
        if (active instanceof HTMLElement && list.includes(active)) {
          moved = focusNextElementInList(active, list, action === TV_ACTION.UP ? 'up' : 'down');
        }
        if (!moved && action === TV_ACTION.DOWN && closeBtn instanceof HTMLElement) {
          moved = focusElement(closeBtn) ? closeBtn : null;
        }
        if (!moved && list[0]) moved = focusElement(list[0]) ? list[0] : null;
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (action === TV_ACTION.LEFT && inSubs && audio.length) {
        const target = audio[audio.length - 1];
        if (focusElement(target)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (action === TV_ACTION.RIGHT && inAudio && subs.length) {
        const target = subs[0];
        if (focusElement(target)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (action === TV_ACTION.UP && onClose) {
        const last = subs[subs.length - 1] || audio[audio.length - 1];
        if (last && focusElement(last)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const action = getTvActionFromKeyEvent(e);
      if (!action) return;

      const currentOverlay = overlayRef.current;
      const arrowZappingActive =
        channelChangeWithArrows &&
        isLiveService &&
        isPlaybackMaximized &&
        !currentOverlay;

      if (arrowZappingActive && (action === TV_ACTION.UP || action === TV_ACTION.DOWN)) {
        return;
      }

      const channelKeyZappingActive =
        isLiveService && isPlaybackMaximized && !currentOverlay;
      if (
        channelKeyZappingActive &&
        (action === TV_ACTION.CHANNEL_UP || action === TV_ACTION.CHANNEL_DOWN)
      ) {
        return;
      }

      if (
        currentOverlay === 'info' &&
        (document.getElementById('epg-event-close') || document.getElementById('player-vod-info-close'))
      ) {
        return;
      }

      if (action === TV_ACTION.BACK) {
        if (currentOverlay) {
          e.preventDefault();
          e.stopPropagation();
          onClosePlayerOverlay?.();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onClosePlayer?.();
        return;
      }

      if (currentOverlay === 'channels') {
        if (
          action === TV_ACTION.UP ||
          action === TV_ACTION.DOWN ||
          action === TV_ACTION.ENTER
        ) {
          handleChannelsNav(action, e);
        }
        return;
      }

      if (currentOverlay === 'tracks') {
        if (
          action === TV_ACTION.UP ||
          action === TV_ACTION.DOWN ||
          action === TV_ACTION.LEFT ||
          action === TV_ACTION.RIGHT
        ) {
          handleTracksNav(action, e);
        }
        return;
      }

      if (currentOverlay) {
        if (action === TV_ACTION.ENTER) return;
        if (action === TV_ACTION.UP || action === TV_ACTION.DOWN) {
          const closeEl = document.getElementById(PLAYER_FOCUS_IDS.OVERLAY_CLOSE);
          if (closeEl instanceof HTMLElement) {
            e.preventDefault();
            e.stopPropagation();
            focusElement(closeEl);
          }
        }
        return;
      }

      const root = hudRootRef?.current;
      if (!(root instanceof HTMLElement)) return;

      if (!visible) {
        const skipWakeForZap =
          (arrowZappingActive || channelKeyZappingActive) &&
          (action === TV_ACTION.UP ||
            action === TV_ACTION.DOWN ||
            action === TV_ACTION.CHANNEL_UP ||
            action === TV_ACTION.CHANNEL_DOWN);
        if (skipWakeForZap) {
          return;
        }
        if (
          action === TV_ACTION.UP ||
          action === TV_ACTION.DOWN ||
          action === TV_ACTION.LEFT ||
          action === TV_ACTION.RIGHT ||
          action === TV_ACTION.ENTER
        ) {
          onWakeHud?.();
          e.preventDefault();
          e.stopPropagation();
          const first =
            (showPlaybackButtons && document.getElementById(PLAYER_FOCUS_IDS.PLAY)) ||
            document.getElementById(PLAYER_FOCUS_IDS.BACK);
          if (first) focusElement(first);
        }
        return;
      }

      if (
        action === TV_ACTION.UP ||
        action === TV_ACTION.DOWN ||
        action === TV_ACTION.LEFT ||
        action === TV_ACTION.RIGHT
      ) {
        handleHudNav(action, e, root);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [
    isTV,
    hasContent,
    visible,
    hudRootRef,
    onWakeHud,
    onClosePlayerOverlay,
    onClosePlayer,
    showPlaybackButtons,
    channelChangeWithArrows,
    isLiveService,
    isPlaybackMaximized,
  ]);
}

export default usePlayerHudTvNavigation;
