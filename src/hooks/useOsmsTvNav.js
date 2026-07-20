import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { focusElementSafe, scrollIntoViewWithinAncestors } from '../navigation/spatialNavigation';

const TARGET_PATH = '/home/osms';

/**
 * Hook de navegación TV para la página de Mensajes (OSMS).
 *
 * La lista de mensajes y los botones de refrescar/marcar-leído son elementos
 * planos (`<button>`) en un layout de dos columnas: el motor de geometría
 * genérico ya resuelve LEFT/RIGHT/UP/DOWN entre ellos sin necesitar un
 * hook de grilla propio. Lo único específico de esta pantalla es DÓNDE
 * colocar el foco inicial (mensaje activo > primer mensaje > botón refrescar).
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

  // Colocar foco inicial al cargar la página.
  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;
    if (initialFocusPlacedRef.current) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tryFocus = () => {
      if (cancelled || initialFocusPlacedRef.current) return;

      const listContainer = document.querySelector('.osms-page .osms-page__list');

      // Mensaje activo/seleccionado primero.
      const activeItem = listContainer?.querySelector('.osms-list-item.is-active');
      if (activeItem instanceof HTMLElement && focusElementSafe(activeItem)) {
        scrollIntoViewWithinAncestors(activeItem, listContainer);
        initialFocusPlacedRef.current = true;
        return;
      }

      // Si no, el primer elemento de la lista.
      const firstItem = document.getElementById('osms-item-0');
      if (firstItem instanceof HTMLElement && focusElementSafe(firstItem)) {
        if (listContainer instanceof HTMLElement) {
          scrollIntoViewWithinAncestors(firstItem, listContainer);
        }
        initialFocusPlacedRef.current = true;
        return;
      }

      // Lista vacía: el botón de actualizar.
      const refreshBtn = document.getElementById('osms-btn-refresh');
      if (refreshBtn instanceof HTMLElement && focusElementSafe(refreshBtn)) {
        initialFocusPlacedRef.current = true;
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
  }, [isTV, location.pathname, itemsCount]);

  // Scroll-into-view defensivo (cubre foco por click; por teclado ya lo hace `moveFocus`).
  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== TARGET_PATH) return undefined;

    const onFocusIn = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const listItem = t.closest('.osms-list-item');
      const listContainer = document.querySelector('.osms-page .osms-page__list');
      if (listItem && listContainer instanceof HTMLElement && listContainer.contains(listItem)) {
        scrollIntoViewWithinAncestors(listItem, listContainer);
      }
    };

    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, [isTV, location.pathname]);
}

export default useOsmsTvNav;
