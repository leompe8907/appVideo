import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { shouldDeferHomeShellNavigation } from '../utils/homeShellOverlays';
import {
  focusElementSafe,
  scrollElementIntoVisibleScrollAncestors,
} from '../utils/homeShellNavigation';

const TARGET_PATH = '/home/osms';

/**
 * Hook de navegación TV para la página de Mensajes (OSMS).
 *
 * @param {{ itemsCount: number }} opts
 */
export function useOsmsTvNav({ itemsCount }) {
  const { isTV } = useDevice();
  const location = useLocation();
  const initialFocusPlacedRef = useRef(false);

  useEffect(() => {
    if (location.pathname !== TARGET_PATH) {
      initialFocusPlacedRef.current = false;
    }
  }, [location.pathname]);

  // Colocar foco inicial al cargar la página
  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;
    if (initialFocusPlacedRef.current) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tryFocus = () => {
      if (cancelled || initialFocusPlacedRef.current) return;

      // Buscar si hay un mensaje activo/seleccionado primero
      const listContainer = document.querySelector('.osms-page .osms-page__list');
      const activeItem = listContainer?.querySelector('.osms-list-item.is-active');
      if (activeItem instanceof HTMLElement) {
        if (focusElementSafe(activeItem)) {
          scrollElementIntoVisibleScrollAncestors(activeItem, listContainer);
          initialFocusPlacedRef.current = true;
          return;
        }
      }

      // Si no, enfocar el primer elemento de la lista
      const firstItem = document.getElementById('osms-item-0');
      if (firstItem instanceof HTMLElement) {
        if (focusElementSafe(firstItem)) {
          if (listContainer instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(firstItem, listContainer);
          }
          initialFocusPlacedRef.current = true;
          return;
        }
      }

      // Si la lista está vacía, enfocar el botón de actualizar
      const refreshBtn = document.getElementById('osms-btn-refresh');
      if (refreshBtn instanceof HTMLElement) {
        if (focusElementSafe(refreshBtn)) {
          initialFocusPlacedRef.current = true;
          return;
        }
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
  }, [isTV, location.pathname, itemsCount]);

  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;

    const queryListContainer = () => document.querySelector('.osms-page .osms-page__list');

    const onFocusIn = (e) => {
      if (shouldDeferHomeShellNavigation()) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const listItem = t.closest('.osms-list-item');
      const listContainer = queryListContainer();
      if (listItem && listContainer instanceof HTMLElement && listContainer.contains(listItem)) {
        scrollElementIntoVisibleScrollAncestors(listItem, listContainer);
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

      const listContainer = queryListContainer();
      const refreshBtn = document.getElementById('osms-btn-refresh');
      const seenBtn = document.getElementById('osms-btn-seen');

      let target = null;

      if (active.id === 'osms-btn-refresh') {
        if (action === TV_ACTION.RIGHT && seenBtn instanceof HTMLElement) {
          target = seenBtn;
        } else if (action === TV_ACTION.DOWN) {
          target = document.getElementById('osms-item-0');
        }
      } else if (active.id === 'osms-btn-seen') {
        if (action === TV_ACTION.LEFT && refreshBtn instanceof HTMLElement) {
          target = refreshBtn;
        } else if (action === TV_ACTION.DOWN) {
          target = document.getElementById('osms-item-0');
        }
      } else if (active.classList.contains('osms-list-item')) {
        const match = active.id.match(/^osms-item-(\d+)$/);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (action === TV_ACTION.UP) {
            if (idx > 0) {
              target = document.getElementById(`osms-item-${idx - 1}`);
            } else if (refreshBtn instanceof HTMLElement) {
              target = refreshBtn;
            }
          } else if (action === TV_ACTION.DOWN) {
            if (idx < itemsCount - 1) {
              target = document.getElementById(`osms-item-${idx + 1}`);
            }
          }
        }
      }

      if (target && target !== active) {
        e.preventDefault();
        e.stopPropagation();
        focusElementSafe(target);
        if (listContainer instanceof HTMLElement && target.classList.contains('osms-list-item')) {
          scrollElementIntoVisibleScrollAncestors(target, listContainer);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [isTV, location.pathname, itemsCount]);
}

export default useOsmsTvNav;
