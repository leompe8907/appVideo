import { useLayoutEffect } from 'react';
import { useDevice } from '../contexts/DeviceContext';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { findFocusableElements, focusNextElementInList } from '../utils/tvNavigation';
import { focusElementSafe, scrollElementIntoVisibleScrollAncestors } from '../utils/homeShellNavigation';
import {
  buildVodCategoryGridRows,
  findVodCardCellInRows,
  getVodRowFocusables,
  VOD_DETAIL_FOCUS_SELECTOR,
  VOD_CATEGORY_GRID_SELECTOR,
} from '../utils/vodTvGrid';

/**
 * Navegación TV en overlays VOD (modal categoría + detalle) y BACK con restauración de foco.
 *
 * @param {{
 *   detailOpen: boolean;
 *   categoryOpen: boolean;
 *   onCloseDetail: () => void;
 *   onCloseCategory: () => void;
 * }} opts
 */
export function useVodOverlayTvNav(opts) {
  const { isTV } = useDevice();
  const detailOpen = Boolean(opts?.detailOpen);
  const categoryOpen = Boolean(opts?.categoryOpen);
  const onCloseDetail = opts?.onCloseDetail;
  const onCloseCategory = opts?.onCloseCategory;

  useLayoutEffect(() => {
    if (!isTV || !categoryOpen || detailOpen) return undefined;

    const timer = setTimeout(() => {
      const grid = document.querySelector(VOD_CATEGORY_GRID_SELECTOR);
      if (!(grid instanceof HTMLElement)) return;
      const list = getVodRowFocusables(grid);
      if (list[0] instanceof HTMLElement) {
        focusElementSafe(list[0]);
        scrollElementIntoVisibleScrollAncestors(list[0], grid);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [isTV, categoryOpen, detailOpen]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (!detailOpen && !categoryOpen) return undefined;

    const onFocusIn = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const grid = t.closest(VOD_CATEGORY_GRID_SELECTOR);
      if (grid instanceof HTMLElement && grid.contains(t)) {
        scrollElementIntoVisibleScrollAncestors(t, grid);
        return;
      }
      const detail = t.closest('.vod-detail-overlay');
      if (detail instanceof HTMLElement) {
        const episodes = t.closest('.vod-detail-episodes-list, .vod-classic-episodes-list');
        if (episodes instanceof HTMLElement) {
          scrollElementIntoVisibleScrollAncestors(t, episodes);
        }
      }
    };

    const handleCategoryNav = (action, e, active) => {
      const grid = document.querySelector(VOD_CATEGORY_GRID_SELECTOR);
      if (!(grid instanceof HTMLElement)) return false;

      if (action === TV_ACTION.BACK) {
        e.preventDefault();
        e.stopPropagation();
        onCloseCategory?.();
        return true;
      }

      const card = active.closest('.vod-card');
      if (!card || !grid.contains(card)) return false;

      const rows = buildVodCategoryGridRows(grid);
      const pos = findVodCardCellInRows(card, rows);
      if (!pos) return false;

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
          target = nextRow[Math.min(pos.ci, nextRow.length - 1)];
        }
      } else if (action === TV_ACTION.UP) {
        const prevRi = pos.ri - 1;
        if (prevRi >= 0) {
          const prevRow = rows[prevRi];
          target = prevRow[Math.min(pos.ci, prevRow.length - 1)];
        } else {
          const closeBtn = document.getElementById('vod-category-close-tv');
          if (closeBtn instanceof HTMLElement) target = closeBtn;
        }
      }

      if (target && target !== active) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        scrollElementIntoVisibleScrollAncestors(target, grid);
      }
      return true;
    };

    const handleDetailNav = (action, e, active) => {
      const overlay = document.querySelector('.vod-detail-overlay');
      if (!(overlay instanceof HTMLElement)) return false;

      if (action === TV_ACTION.BACK) {
        e.preventDefault();
        e.stopPropagation();
        onCloseDetail?.();
        return true;
      }

      if (!overlay.contains(active)) return false;

      const focusables = findFocusableElements(overlay, VOD_DETAIL_FOCUS_SELECTOR);
      if (!focusables.length) return false;

      if (
        action !== TV_ACTION.UP &&
        action !== TV_ACTION.DOWN &&
        action !== TV_ACTION.LEFT &&
        action !== TV_ACTION.RIGHT
      ) {
        return false;
      }

      const direction =
        action === TV_ACTION.UP || action === TV_ACTION.LEFT ? 'up' : 'down';
      let target = null;
      if (focusables.includes(active)) {
        target = focusNextElementInList(active, focusables, direction);
      }
      if (!target && direction === 'down') {
        target = focusables[0];
      }
      if (!target && direction === 'up') {
        target = focusables[focusables.length - 1];
      }

      if (target && target !== active) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        const episodes = target.closest('.vod-detail-episodes-list, .vod-classic-episodes-list');
        if (episodes instanceof HTMLElement) {
          scrollElementIntoVisibleScrollAncestors(target, episodes);
        }
      }
      return true;
    };

    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const action = getTvActionFromKeyEvent(e);
      if (!action) return;

      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;

      if (detailOpen) {
        if (handleDetailNav(action, e, active)) return;
      }

      if (categoryOpen && !detailOpen) {
        if (handleCategoryNav(action, e, active)) return;
      }
    };

    document.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [isTV, detailOpen, categoryOpen, onCloseDetail, onCloseCategory]);
}

export default useVodOverlayTvNav;
