import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { shouldDeferHomeShellNavigation } from '../utils/homeShellOverlays';
import {
  focusElementSafe,
  scrollElementIntoVisibleScrollAncestors,
} from '../utils/homeShellNavigation';
import { rememberMainShellFocus } from '../utils/homeShellLastContentFocus';
import { useSearchSessionStore } from '../store/searchSessionStore';

const TARGET_PATH = '/home/buscador';
const INPUT_ID = 'search-input-tv';
const CLEAR_ID = 'search-clear-btn';
const RESULT_COLS = 6;

function querySearchRoot() {
  return document.querySelector('.search-page .search-container');
}

function getVisibleTabs() {
  const tabs = document.querySelector('.search-page .search-tabs');
  if (!(tabs instanceof HTMLElement)) return [];
  return Array.from(tabs.querySelectorAll('.search-tab'));
}

function getVisibleResults() {
  const results = document.querySelector('.search-page .search-results');
  if (!(results instanceof HTMLElement)) return [];
  return Array.from(results.querySelectorAll('.search-result'));
}

/** Listas de resultados por grilla (una por sección en «Todos», una sola en tabs filtrados). */
function getResultSectionLists() {
  const resultsArea = document.querySelector('.search-page .search-results');
  if (!(resultsArea instanceof HTMLElement)) return [];

  const sectionLists = Array.from(
    resultsArea.querySelectorAll('.search-section .search-list'),
  );
  if (sectionLists.length > 0) {
    return sectionLists.map((list) => Array.from(list.querySelectorAll('.search-result')));
  }

  const singleList = resultsArea.querySelector(':scope > .search-list');
  if (singleList instanceof HTMLElement) {
    return [Array.from(singleList.querySelectorAll('.search-result'))];
  }

  return [];
}

function locateResultInSections(lists, element) {
  for (let sectionIdx = 0; sectionIdx < lists.length; sectionIdx += 1) {
    const itemIdx = lists[sectionIdx].indexOf(element);
    if (itemIdx >= 0) {
      return { sectionIdx, itemIdx, items: lists[sectionIdx] };
    }
  }
  return null;
}

function gridCol(itemIdx, cols) {
  return itemIdx % cols;
}

function gridRow(itemIdx, cols) {
  return Math.floor(itemIdx / cols);
}

function moveDownInGrid(items, itemIdx, cols) {
  const row = gridRow(itemIdx, cols);
  const col = gridCol(itemIdx, cols);
  const lastRow = gridRow(items.length - 1, cols);
  if (row >= lastRow) return null;

  const nextRowStart = (row + 1) * cols;
  const itemsInNextRow = Math.min(cols, items.length - nextRowStart);
  const targetIdx = nextRowStart + Math.min(col, itemsInNextRow - 1);
  return items[targetIdx] ?? null;
}

function moveUpInGrid(items, itemIdx, cols) {
  const row = gridRow(itemIdx, cols);
  const col = gridCol(itemIdx, cols);
  if (row <= 0) return null;

  const prevRowStart = (row - 1) * cols;
  const itemsInPrevRow = Math.min(cols, items.length - prevRowStart);
  const targetIdx = prevRowStart + Math.min(col, itemsInPrevRow - 1);
  return items[targetIdx] ?? null;
}

function moveToNextSection(lists, sectionIdx, col, cols) {
  const nextItems = lists[sectionIdx + 1];
  if (!nextItems?.length) return null;
  const targetIdx = Math.min(col, nextItems.length - 1);
  return nextItems[targetIdx] ?? null;
}

function moveToPrevSection(lists, sectionIdx, col, cols) {
  const prevItems = lists[sectionIdx - 1];
  if (!prevItems?.length) return null;
  const lastRowStart = gridRow(prevItems.length - 1, cols) * cols;
  const itemsInLastRow = prevItems.length - lastRowStart;
  const targetIdx = lastRowStart + Math.min(col, itemsInLastRow - 1);
  return prevItems[targetIdx] ?? null;
}

function resolveSearchResultTarget(active, action, tabs, input) {
  const lists = getResultSectionLists();
  const located = locateResultInSections(lists, active);
  if (!located) return null;

  const { sectionIdx, itemIdx, items } = located;
  const col = gridCol(itemIdx, RESULT_COLS);
  const row = gridRow(itemIdx, RESULT_COLS);

  if (action === TV_ACTION.LEFT) {
    if (col > 0) return items[itemIdx - 1];
    return getSearchSidebarFocusTarget();
  }

  if (action === TV_ACTION.RIGHT) {
    const next = items[itemIdx + 1];
    if (next && gridRow(itemIdx + 1, RESULT_COLS) === row) return next;
    return null;
  }

  if (action === TV_ACTION.UP) {
    const within = moveUpInGrid(items, itemIdx, RESULT_COLS);
    if (within) return within;
    if (row === 0 && sectionIdx > 0) {
      return moveToPrevSection(lists, sectionIdx, col, RESULT_COLS);
    }
    if (row === 0 && tabs.length > 0) {
      return tabs.find((t) => t.classList.contains('active')) ?? tabs[Math.min(col, tabs.length - 1)];
    }
    if (row === 0 && input instanceof HTMLElement) return input;
    return null;
  }

  if (action === TV_ACTION.DOWN) {
    const within = moveDownInGrid(items, itemIdx, RESULT_COLS);
    if (within) return within;
    if (sectionIdx < lists.length - 1) {
      return moveToNextSection(lists, sectionIdx, col, RESULT_COLS);
    }
    return null;
  }

  return null;
}

function isSearchInput(el) {
  return el instanceof HTMLElement && el.id === INPUT_ID;
}

function isSearchClear(el) {
  return el instanceof HTMLElement && el.id === CLEAR_ID;
}

function isSearchTab(el) {
  return el instanceof HTMLElement && el.classList.contains('search-tab');
}

function isSearchResult(el) {
  return el instanceof HTMLElement && el.classList.contains('search-result');
}

function querySidebar() {
  return document.querySelector('aside.home-sidebar[data-home-scope="sidebar"]');
}

function getSearchSidebarFocusTarget() {
  const sidebar = querySidebar();
  if (!(sidebar instanceof HTMLElement)) return null;
  const target =
    sidebar.querySelector('a.home-sidebar-link[href="/home/buscador"]') ||
    sidebar.querySelector('a.home-sidebar-link.active') ||
    sidebar.querySelector('a.home-sidebar-link');
  return target instanceof HTMLElement ? target : null;
}

function isInputEditing() {
  const input = document.getElementById(INPUT_ID);
  if (!(input instanceof HTMLInputElement)) return false;
  return !input.readOnly;
}

/**
 * Navegación TV en buscador — Opción B:
 * LRUD entre input → tabs → resultados; IME solo al pulsar ENTER en el input (FocusableInput).
 *
 * @param {{ modalOpen?: boolean, restoreSignal?: string, resultCount?: number }} opts
 */
export function useSearchPageTvNav(opts = {}) {
  const modalOpen = Boolean(opts.modalOpen);
  const restoreSignal = opts.restoreSignal ?? '';
  const resultCount = opts.resultCount ?? 0;
  const { isTV } = useDevice();
  const location = useLocation();
  const initialFocusRef = useRef(false);

  useEffect(() => {
    if (location.pathname !== TARGET_PATH) {
      initialFocusRef.current = false;
    }
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;
    if (initialFocusRef.current) return undefined;
    if (modalOpen) return undefined;

    let cancelled = false;
    let attempts = 0;

    const escapeAttr = (value) => {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
      }
      return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    };

    const tryRestoreFocus = () => {
      if (cancelled || initialFocusRef.current) return;

      const focusedKey = useSearchSessionStore.getState().focusedResultKey;
      if (focusedKey && resultCount > 0) {
        const el = document.querySelector(`[data-search-result-key="${escapeAttr(focusedKey)}"]`);
        if (el instanceof HTMLElement && focusElementSafe(el)) {
          initialFocusRef.current = true;
          const root = querySearchRoot();
          if (root instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(el, root);
          }
          return;
        }
      }

      const input = document.getElementById(INPUT_ID);
      if (input instanceof HTMLElement && focusElementSafe(input)) {
        initialFocusRef.current = true;
        return;
      }

      attempts += 1;
      if (attempts < 30) {
        requestAnimationFrame(tryRestoreFocus);
      }
    };

    requestAnimationFrame(tryRestoreFocus);
    return () => {
      cancelled = true;
    };
  }, [isTV, location.pathname, modalOpen, restoreSignal, resultCount]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;

    const scrollRoot = () => querySearchRoot();

    const onFocusIn = (e) => {
      if (shouldDeferHomeShellNavigation() || modalOpen) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const root = scrollRoot();
      if (!root || !root.contains(t)) return;
      if (isSearchResult(t)) {
        scrollElementIntoVisibleScrollAncestors(t, root);
        const key = t.getAttribute('data-search-result-key');
        if (key) {
          useSearchSessionStore.getState().setFocusedResultKey(key);
        }
      }
    };

    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (shouldDeferHomeShellNavigation() || modalOpen) return;
      if (isInputEditing()) return;

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

      const root = scrollRoot();
      if (!root || !root.contains(active)) return;

      const tabs = getVisibleTabs();
      const results = getVisibleResults();
      const clearBtn = document.getElementById(CLEAR_ID);
      const input = document.getElementById(INPUT_ID);

      let target = null;

      if (isSearchInput(active)) {
        if (action === TV_ACTION.LEFT) {
          target = getSearchSidebarFocusTarget();
          if (target) {
            rememberMainShellFocus(active);
          }
        } else if (action === TV_ACTION.RIGHT && clearBtn instanceof HTMLElement) {
          target = clearBtn;
        } else if (action === TV_ACTION.DOWN) {
          target = tabs[0] ?? results[0] ?? null;
        }
      } else if (isSearchClear(active)) {
        if (action === TV_ACTION.LEFT && input instanceof HTMLElement) {
          target = input;
        } else if (action === TV_ACTION.DOWN) {
          target = tabs[0] ?? results[0] ?? null;
        } else if (action === TV_ACTION.RIGHT) {
          target = tabs[0] ?? results[0] ?? null;
        }
      } else if (isSearchTab(active)) {
        const tabIdx = tabs.indexOf(active);
        if (action === TV_ACTION.LEFT && tabIdx > 0) {
          target = tabs[tabIdx - 1];
        } else if (action === TV_ACTION.RIGHT && tabIdx >= 0 && tabIdx < tabs.length - 1) {
          target = tabs[tabIdx + 1];
        } else if (action === TV_ACTION.UP) {
          target = input instanceof HTMLElement ? input : null;
        } else if (action === TV_ACTION.DOWN) {
          target = results[0] ?? null;
        }
      } else if (isSearchResult(active)) {
        target = resolveSearchResultTarget(active, action, tabs, input);
        const sidebar = querySidebar();
        if (target && sidebar instanceof HTMLElement && sidebar.contains(target)) {
          rememberMainShellFocus(active);
        }
      }

      if (target && target !== active) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        const sidebar = querySidebar();
        if (sidebar instanceof HTMLElement && sidebar.contains(target)) {
          scrollElementIntoVisibleScrollAncestors(target, sidebar);
        } else if (root instanceof HTMLElement) {
          scrollElementIntoVisibleScrollAncestors(target, root);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [isTV, location.pathname, modalOpen]);
}

export default useSearchPageTvNav;
