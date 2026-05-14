import { useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDevice } from '../../contexts/DeviceContext';
import { getTvActionFromKeyEvent, isTextInputElement, TV_ACTION } from '../../utils/tvRemote';
import {
  dismissEpgReminderOverlayFromDom,
  isEpgEventModalOverlayInDom,
  shouldDeferHomeShellNavigation,
} from '../../utils/homeShellOverlays';
import { focusElementSafe, getVisibleFocusablesInContainer } from '../../utils/homeShellNavigation';
import { isLeftmostChannelCardInInicioWall } from '../../utils/inicioBouquetTvGrid';
import { isLeftmostVodRecommendedRailFocusable } from '../../utils/inicioVodRecommendedHomeRail';

/**
 * Dispatcher shell Home (Fase 1 + cruce TV sidebar↔contenido + BACK en rutas /home/*).
 * Montar como **primer hijo** de `HomePage` para `capture: true` antes que `PlayerHud`.
 *
 * @param {{ isPlayerActive: boolean }} props
 */
export function HomeInputDispatcher({ isPlayerActive }) {
  const { isTV } = useDevice();
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const action = getTvActionFromKeyEvent(e);

      // --- BACK ---
      if (action === TV_ACTION.BACK) {
        if (e.repeat) return;

        // Recordatorio EPG (puede mostrarse con player activo): debe procesarse antes de delegar al HUD.
        if (isEpgEventModalOverlayInDom()) {
          const dismissed = dismissEpgReminderOverlayFromDom();
          if (dismissed) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (isPlayerActive) return;

        if (shouldDeferHomeShellNavigation()) return;

        if (isTextInputElement(document.activeElement)) return;

        const path = location.pathname || '';
        if (path.startsWith('/home/') && path !== '/home/inicio') {
          e.preventDefault();
          e.stopPropagation();
          navigate(-1);
          return;
        }

        // /home/inicio: no consumir BACK (permite salida SO / historial real del WebView).
        return;
      }

      // --- LRUD sidebar ↔ main (solo TV, sin player ni overlays bloqueantes) ---
      if (!isTV || isPlayerActive) return;
      if (shouldDeferHomeShellNavigation()) return;
      if (isTextInputElement(document.activeElement)) return;

      if (action !== TV_ACTION.RIGHT && action !== TV_ACTION.LEFT) return;

      const active = document.activeElement;
      if (!active || !(active instanceof HTMLElement)) return;

      const sidebar = document.querySelector('aside.home-sidebar[data-home-scope="sidebar"]');
      const mainEl = document.querySelector('main.home-content[data-home-scope="content"]');
      if (!sidebar || !mainEl) return;

      if (action === TV_ACTION.RIGHT) {
        if (!sidebar.contains(active)) return;
        e.preventDefault();
        e.stopPropagation();
        const list = getVisibleFocusablesInContainer(mainEl);
        const target = list[0];
        if (target) focusElementSafe(target);
        return;
      }

      if (action === TV_ACTION.LEFT) {
        if (active.closest('[data-home-spatial-delegate="true"]')) return;
        if (!mainEl.contains(active)) return;

        const path = location.pathname || '';
        const inicioScroll =
          path === '/home/inicio' ? document.querySelector('.bouquet-inicio-scroll') : null;
        const fromBouquetRowLeftEdge =
          inicioScroll instanceof HTMLElement && isLeftmostChannelCardInInicioWall(active, inicioScroll);
        const fromVodRailLeftEdge =
          inicioScroll instanceof HTMLElement && isLeftmostVodRecommendedRailFocusable(active, inicioScroll);

        const list = getVisibleFocusablesInContainer(mainEl);
        const fromFirstMainFocusable = list.length > 0 && list[0] === active;

        if (!fromBouquetRowLeftEdge && !fromVodRailLeftEdge && !fromFirstMainFocusable) return;

        e.preventDefault();
        e.stopPropagation();
        const activeLink =
          sidebar.querySelector('a.home-sidebar-link.active') ||
          sidebar.querySelector('a.home-sidebar-link');
        const settingsBtn = sidebar.querySelector('button.home-sidebar-settings-btn');
        const target = activeLink || settingsBtn;
        if (target instanceof HTMLElement) focusElementSafe(target);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isPlayerActive, isTV, location.pathname, navigate]);

  return null;
}

export default HomeInputDispatcher;
