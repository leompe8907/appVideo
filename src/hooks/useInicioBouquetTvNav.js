import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { usePreload } from '../store/usePreload';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { shouldDeferHomeShellNavigation } from '../utils/homeShellOverlays';
import {
  focusElementSafe,
  scrollElementIntoVisibleScrollAncestors,
} from '../utils/homeShellNavigation';
import { buildInicioBouquetChannelRows, findChannelCardCellInRows } from '../utils/inicioBouquetTvGrid';

/**
 * Navegación por mando en el muro de bouquets de Inicio (`/home/inicio`).
 * @param {{ scrollRootSelector?: string }} [opts]
 */
export function useInicioBouquetTvNav(opts = {}) {
  const { isTV } = useDevice();
  const location = useLocation();
  const scrollRootSelector = opts.scrollRootSelector || '.bouquet-inicio-scroll';
  const epg = usePreload((s) => s.epg);
  const epgWallKey =
    epg.status === 'ready'
      ? `ready:${(epg.bouquetsWithChannels || []).length}`
      : `other:${epg.status}`;
  const wallFocusPlacedRef = useRef(false);

  useEffect(() => {
    if (location.pathname !== '/home/inicio') {
      wallFocusPlacedRef.current = false;
    }
  }, [location.pathname]);

  /** TV: al mostrar Inicio, foco en la primera tarjeta del muro (no en el sidebar). */
  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== '/home/inicio') return undefined;
    if (wallFocusPlacedRef.current) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const tryFocus = () => {
      if (cancelled) return;
      if (wallFocusPlacedRef.current) return;
      const scrollRoot = document.querySelector(scrollRootSelector);
      const first =
        scrollRoot?.querySelector?.('.bouquet-wall .channel-card') ?? null;
      if (first instanceof HTMLElement) {
        if (focusElementSafe(first)) {
          if (scrollRoot instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(first, scrollRoot);
          }
          wallFocusPlacedRef.current = true;
        }
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryFocus);
      }
    };

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(tryFocus);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isTV, location.pathname, scrollRootSelector, epgWallKey]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== '/home/inicio') return undefined;

    const scrollRoot = document.querySelector(scrollRootSelector);
    if (!(scrollRoot instanceof HTMLElement)) return undefined;

    const onFocusIn = (e) => {
      if (shouldDeferHomeShellNavigation()) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const card = t.closest('.channel-card');
      if (!card || !scrollRoot.contains(card)) return;
      const wall = scrollRoot.querySelector('.bouquet-wall');
      if (!wall || !wall.contains(card)) return;
      scrollElementIntoVisibleScrollAncestors(card, scrollRoot);
    };

    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (shouldDeferHomeShellNavigation()) return;

      const active = document.activeElement;
      if (!active || !(active instanceof HTMLElement)) return;

      if (!scrollRoot.contains(active)) return;

      const card = active.closest('.channel-card');
      if (!card || !scrollRoot.contains(card)) return;

      const wall = scrollRoot.querySelector('.bouquet-wall');
      if (!wall || !wall.contains(card)) return;

      const action = getTvActionFromKeyEvent(e);
      if (
        action !== TV_ACTION.UP &&
        action !== TV_ACTION.DOWN &&
        action !== TV_ACTION.LEFT &&
        action !== TV_ACTION.RIGHT
      ) {
        return;
      }

      const rows = buildInicioBouquetChannelRows(wall);
      const pos = findChannelCardCellInRows(card, rows);
      if (!pos) return;

      let target = null;
      if (action === TV_ACTION.RIGHT) {
        const row = rows[pos.ri];
        if (pos.ci + 1 < row.length) target = row[pos.ci + 1];
      } else if (action === TV_ACTION.LEFT) {
        const row = rows[pos.ri];
        if (pos.ci > 0) target = row[pos.ci - 1];
      } else if (action === TV_ACTION.DOWN) {
        const nextRi = pos.ri + 1;
        if (nextRi < rows.length) {
          const nextRow = rows[nextRi];
          const idx = Math.min(pos.ci, nextRow.length - 1);
          target = nextRow[idx];
        }
      } else if (action === TV_ACTION.UP) {
        const prevRi = pos.ri - 1;
        if (prevRi >= 0) {
          const prevRow = rows[prevRi];
          const idx = Math.min(pos.ci, prevRow.length - 1);
          target = prevRow[idx];
        }
      }

      if (target && target !== card) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        if (scrollRoot instanceof HTMLElement) {
          scrollElementIntoVisibleScrollAncestors(target, scrollRoot);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    scrollRoot.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      scrollRoot.removeEventListener('focusin', onFocusIn, true);
    };
  }, [isTV, location.pathname, scrollRootSelector]);
}

export default useInicioBouquetTvNav;
