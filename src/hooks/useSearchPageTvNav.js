import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { TV_ACTION } from '../utils/tvRemote';
import { navigationRouter } from '../navigation/NavigationRouter';
import { focusElementSafe, scrollIntoViewWithinAncestors } from '../navigation/spatialNavigation';
import { useSearchSessionStore } from '../store/searchSessionStore';

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

/**
 * Navegación TV en buscador.
 *
 * La mayor parte de la navegación (tabs ↔ resultados ↔ sidebar, multi-fila,
 * multi-sección) ya no necesita un modelo de grilla propio: el motor de
 * geometría (`NavigationRouter` + `spatialNavigation.js`) navega por posición
 * real en pantalla igual que en el resto de la app.
 *
 * Lo único que el motor genérico NO puede resolver solo es salir del campo de
 * búsqueda: es un `<input>` (aunque `readOnly` en TV para bloquear el IME
 * nativo — ver `FocusableInput`) y el router nunca mueve el foco fuera de un
 * input de texto por defecto (para no comerse el movimiento del caret). Por
 * eso este hook solo registra las 3 salidas explícitas del input.
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

  // Restaurar el foco en el último resultado enfocado (o el input) al volver al buscador.
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
            scrollIntoViewWithinAncestors(el, root);
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

  // Única lógica no-genérica: salir del input de búsqueda con LEFT/RIGHT/DOWN.
  useEffect(() => {
    if (!isTV) return undefined;

    const unregister = navigationRouter.register('global', (action) => {
      if (location.pathname !== TARGET_PATH) return false;
      if (modalOpen) return false;

      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active.id !== INPUT_ID) return false;

      if (action === TV_ACTION.LEFT) {
        return focusElementSafe(getSearchSidebarFocusTarget());
      }
      if (action === TV_ACTION.RIGHT) {
        return focusElementSafe(document.getElementById(CLEAR_ID));
      }
      if (action === TV_ACTION.DOWN) {
        const tabs = getVisibleTabs();
        const results = getVisibleResults();
        return focusElementSafe(tabs[0] ?? results[0] ?? null);
      }
      return false;
    });

    return unregister;
  }, [isTV, location.pathname, modalOpen]);

  // Scroll-into-view + recordar la key del resultado enfocado (para restaurar luego).
  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;

    const onFocusIn = (e) => {
      if (modalOpen) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const root = querySearchRoot();
      if (!(root instanceof HTMLElement) || !root.contains(t)) return;
      if (t.classList.contains('search-result')) {
        scrollIntoViewWithinAncestors(t, root);
        const key = t.getAttribute('data-search-result-key');
        if (key) {
          useSearchSessionStore.getState().setFocusedResultKey(key);
        }
      }
    };

    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, [isTV, location.pathname, modalOpen]);
}

export default useSearchPageTvNav;
