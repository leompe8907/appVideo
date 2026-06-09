import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { shouldDeferHomeShellNavigation } from '../utils/homeShellOverlays';
import {
  focusElementSafe,
  scrollElementIntoVisibleScrollAncestors,
} from '../utils/homeShellNavigation';

const TARGET_PATH = '/home/buscador';
const INPUT_ID = 'search-input-tv';
const CLEAR_ID = 'search-clear-btn';

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

function isInputEditing() {
  const input = document.getElementById(INPUT_ID);
  if (!(input instanceof HTMLInputElement)) return false;
  return !input.readOnly;
}

/**
 * Navegación TV en buscador — Opción B:
 * LRUD entre input → tabs → resultados; IME solo al pulsar ENTER en el input (FocusableInput).
 *
 * @param {{ modalOpen?: boolean }} opts
 */
export function useSearchPageTvNav(opts = {}) {
  const modalOpen = Boolean(opts.modalOpen);
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

    const input = document.getElementById(INPUT_ID);
    if (input instanceof HTMLElement && focusElementSafe(input)) {
      initialFocusRef.current = true;
    }
  }, [isTV, location.pathname]);

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
        if (action === TV_ACTION.RIGHT && clearBtn instanceof HTMLElement) {
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
        const resIdx = results.indexOf(active);
        if (action === TV_ACTION.UP) {
          if (resIdx > 0) {
            target = results[resIdx - 1];
          } else if (tabs.length > 0) {
            const activeTab = tabs.find((t) => t.classList.contains('active'));
            target = activeTab ?? tabs[tabs.length - 1];
          } else if (input instanceof HTMLElement) {
            target = input;
          }
        } else if (action === TV_ACTION.DOWN && resIdx >= 0 && resIdx < results.length - 1) {
          target = results[resIdx + 1];
        }
      }

      if (target && target !== active) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        if (root instanceof HTMLElement) {
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
