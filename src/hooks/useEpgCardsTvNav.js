import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { shouldDeferHomeShellNavigation } from '../utils/homeShellOverlays';
import {
  focusElementSafe,
  scrollElementIntoVisibleScrollAncestors,
} from '../utils/homeShellNavigation';

const TARGET_PATH = '/home/epg';

function findNearestEnabledCard(r, c, colCount) {
  // Intentar la misma columna, luego las adyacentes
  const offsets = [0, -1, 1, -2, 2, -3, 3];
  for (const offset of offsets) {
    const targetCol = c + offset;
    if (targetCol >= 0 && targetCol < colCount) {
      const card = document.getElementById(`epg-card-${r}-${targetCol}`);
      if (card && !card.classList.contains('disabled')) {
        return card;
      }
    }
  }
  return null;
}

/**
 * Hook de navegación TV para la Guía de Canales (EPG).
 *
 * @param {{ modalOpen: boolean, epgPastEnabled: boolean, channelsCount: number }} opts
 */
export function useEpgCardsTvNav({ modalOpen, epgPastEnabled, channelsCount }) {
  const { isTV } = useDevice();
  const location = useLocation();
  const initialFocusPlacedRef = useRef(false);
  const colCount = epgPastEnabled ? 4 : 3;

  useEffect(() => {
    if (location.pathname !== TARGET_PATH) {
      initialFocusPlacedRef.current = false;
    }
  }, [location.pathname]);

  // Colocar foco inicial al cargar los canales
  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;
    if (initialFocusPlacedRef.current) return undefined;
    if (channelsCount === 0) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tryFocus = () => {
      if (cancelled || initialFocusPlacedRef.current) return;
      const grid = document.querySelector('.epg-cards-page .epg-cards-grid');
      if (!(grid instanceof HTMLElement)) {
        attempts += 1;
        if (attempts < maxAttempts) requestAnimationFrame(tryFocus);
        return;
      }

      // Buscar la primera tarjeta de canal que no esté deshabilitada
      const cards = Array.from(grid.querySelectorAll('.epg-card:not(.disabled)'));
      const first = cards[0];
      if (first instanceof HTMLElement) {
        if (focusElementSafe(first)) {
          scrollElementIntoVisibleScrollAncestors(first, grid);
          initialFocusPlacedRef.current = true;
        }
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) requestAnimationFrame(tryFocus);
    };

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(tryFocus);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isTV, location.pathname, channelsCount]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;

    const queryGrid = () => document.querySelector('.epg-cards-page .epg-cards-grid');

    const onFocusIn = (e) => {
      if (shouldDeferHomeShellNavigation() || modalOpen) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const card = t.closest('.epg-card');
      const grid = queryGrid();
      if (card && grid instanceof HTMLElement && grid.contains(card)) {
        scrollElementIntoVisibleScrollAncestors(card, grid);
      }
    };

    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (shouldDeferHomeShellNavigation() || modalOpen) return;

      const action = getTvActionFromKeyEvent(e);
      if (
        action !== TV_ACTION.UP &&
        action !== TV_ACTION.DOWN &&
        action !== TV_ACTION.LEFT &&
        action !== TV_ACTION.RIGHT
      ) {
        return;
      }

      const active = document.activeElement;
      if (!active || !(active instanceof HTMLElement)) return;

      const grid = queryGrid();
      if (!grid || !grid.contains(active)) return;

      const match = active.id.match(/^epg-card-(\d+)-(\d+)$/);
      if (!match) return;

      const ri = parseInt(match[1], 10);
      const ci = parseInt(match[2], 10);

      const getCard = (r, c) => document.getElementById(`epg-card-${r}-${c}`);
      let target = null;

      if (action === TV_ACTION.RIGHT) {
        for (let c = ci + 1; c < colCount; c++) {
          const card = getCard(ri, c);
          if (card && !card.classList.contains('disabled')) {
            target = card;
            break;
          }
        }
      } else if (action === TV_ACTION.LEFT) {
        for (let c = ci - 1; c >= 0; c--) {
          const card = getCard(ri, c);
          if (card && !card.classList.contains('disabled')) {
            target = card;
            break;
          }
        }
      } else if (action === TV_ACTION.DOWN) {
        const nextRi = ri + 1;
        if (nextRi < channelsCount) {
          target = findNearestEnabledCard(nextRi, ci, colCount);
        }
      } else if (action === TV_ACTION.UP) {
        const prevRi = ri - 1;
        if (prevRi >= 0) {
          target = findNearestEnabledCard(prevRi, ci, colCount);
        }
      }

      if (target && target !== active) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        scrollElementIntoVisibleScrollAncestors(target, grid);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [isTV, location.pathname, modalOpen, channelsCount, colCount]);
}

export default useEpgCardsTvNav;
