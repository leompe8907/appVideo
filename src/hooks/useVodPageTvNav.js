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
import {
  buildVodBouquetRows,
  findVodCardCellInRows,
} from '../utils/vodTvGrid';
import { requestTvFocusRingSync } from '../components/navigation/TvFocusRing';

const TARGET_PATH = '/home/vod';

/**
 * Navegación TV en la página VOD: LRUD entre filas/géneros, scroll al foco, puentes con ads.
 */
export function useVodPageTvNav() {
  const { isTV } = useDevice();
  const location = useLocation();
  const vod = usePreload((s) => s.vod);
  const vodKey =
    vod.status === 'ready'
      ? `ready:${(vod.categories || []).length}`
      : `other:${vod.status}`;
  const initialFocusPlacedRef = useRef(false);

  useEffect(() => {
    if (location.pathname !== TARGET_PATH) {
      initialFocusPlacedRef.current = false;
    }
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;
    if (initialFocusPlacedRef.current) return undefined;

    const content = document.querySelector('.vod-page .vod-content');
    const active = document.activeElement;
    if (
      content instanceof HTMLElement &&
      active instanceof HTMLElement &&
      content.contains(active) &&
      active.closest('.vod-card, .vod-see-more-card')
    ) {
      initialFocusPlacedRef.current = true;
      requestTvFocusRingSync();
      return undefined;
    }

    if (vod.status !== 'ready') return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tryFocus = () => {
      if (cancelled || initialFocusPlacedRef.current) return;
      const content = document.querySelector('.vod-page .vod-content');
      if (!(content instanceof HTMLElement)) {
        attempts += 1;
        if (attempts < maxAttempts) requestAnimationFrame(tryFocus);
        return;
      }
      const rows = buildVodBouquetRows(content);
      const first = rows[0]?.[0];
      if (first instanceof HTMLElement) {
        if (focusElementSafe(first)) {
          scrollElementIntoVisibleScrollAncestors(first, content);
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
  }, [isTV, location.pathname, vodKey, vod.status]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;

    const queryContent = () => document.querySelector('.vod-page .vod-content');
    const queryStack = () =>
      document.querySelector('main.home-content[data-home-scope="content"] .home-content-stack');

    const onFocusIn = (e) => {
      if (shouldDeferHomeShellNavigation()) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const card = t.closest('.vod-card');
      const content = queryContent();
      if (card && content instanceof HTMLElement && content.contains(card)) {
        scrollElementIntoVisibleScrollAncestors(card, content);
      }
    };

    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (shouldDeferHomeShellNavigation()) return;

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

      const content = queryContent();
      const stack = queryStack();
      const main = document.querySelector('main.home-content[data-home-scope="content"]');

      if (action === TV_ACTION.DOWN && active.closest('.home-ad-zone[data-ad-zone="top"]')) {
        const rows = content instanceof HTMLElement ? buildVodBouquetRows(content) : [];
        const first = rows[0]?.[0];
        if (first instanceof HTMLElement) {
          e.preventDefault();
          e.stopPropagation();
          focusElementSafe(first);
          if (content instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(first, content);
          }
        }
        return;
      }

      if (action === TV_ACTION.UP && active.closest('.home-ad-zone[data-ad-zone="bottom"]')) {
        if (content instanceof HTMLElement) {
          const rows = buildVodBouquetRows(content);
          const lastRow = rows[rows.length - 1];
          const target = lastRow?.[0];
          if (target instanceof HTMLElement) {
            e.preventDefault();
            e.stopPropagation();
            focusElementSafe(target);
            scrollElementIntoVisibleScrollAncestors(target, content);
          }
        }
        return;
      }

      const card = active.closest('.vod-card');
      if (!card || !(content instanceof HTMLElement) || !content.contains(card)) return;

      const rows = buildVodBouquetRows(content);
      const pos = findVodCardCellInRows(card, rows);
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

      if (!target && action === TV_ACTION.UP && pos.ri === 0) {
        const topZone =
          stack?.querySelector?.('.home-ad-zone[data-ad-zone="top"]') ??
          main?.querySelector?.('.home-ad-zone[data-ad-zone="top"]');
        if (topZone instanceof HTMLElement) {
          e.preventDefault();
          e.stopPropagation();
          focusElementSafe(topZone);
          if (stack instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(topZone, stack);
          }
        }
        return;
      }

      if (!target && action === TV_ACTION.DOWN && pos.ri === rows.length - 1) {
        const bottom = main?.querySelector?.('.home-ad-zone[data-ad-zone="bottom"]');
        if (bottom instanceof HTMLElement) {
          e.preventDefault();
          e.stopPropagation();
          focusElementSafe(bottom);
          if (stack instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(bottom, stack);
          }
        }
        return;
      }

      if (target && target !== card) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        scrollElementIntoVisibleScrollAncestors(target, content);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [isTV, location.pathname]);
}

export default useVodPageTvNav;
