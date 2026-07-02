import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDevice } from '../../contexts/DeviceContext';
import { getTvActionFromKeyEvent, isTextInputElement, TV_ACTION } from '../../utils/tvRemote';
import {
  dismissEpgReminderOverlayFromDom,
  dismissOsdKeyboardOverlayFromDom,
  isEpgEventModalOverlayInDom,
  isOsdKeyboardOverlayInDom,
  shouldDeferHomeShellNavigation,
} from '../../utils/homeShellOverlays';
import {
  focusElementSafe,
  getVisibleFocusablesInContainer,
  scrollElementIntoVisibleScrollAncestors,
} from '../../utils/homeShellNavigation';
import {
  clearMainShellFocusMemory,
  getRestoredMainFocusTargetIfValid,
  rememberMainShellFocus,
} from '../../utils/homeShellLastContentFocus';
import { isLeftmostChannelCardInInicioWall } from '../../utils/inicioBouquetTvGrid';
import { isLeftmostVodRecommendedRailFocusable } from '../../utils/inicioVodRecommendedHomeRail';
import { isLeftmostVodCardInVodPage } from '../../utils/vodTvGrid';

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

  useEffect(() => {
    clearMainShellFocusMemory();
  }, [location.pathname]);

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

        // Teclado virtual OSD: cerrar overlay y bloquear BACK nativo del WebView (evita history.back).
        if (isOsdKeyboardOverlayInDom()) {
          const dismissed = dismissOsdKeyboardOverlayFromDom();
          if (dismissed) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (isPlayerActive) return;

        if (shouldDeferHomeShellNavigation()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

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
        if (active.matches('button.home-sidebar-settings-btn')) return;
        if (active.matches('.home-sidebar-sublink')) {
          const submenu = active.closest('.home-sidebar-submenu');
          if (submenu) {
            const subs = Array.from(submenu.querySelectorAll('.home-sidebar-sublink'));
            const idx = subs.indexOf(active);
            if (idx >= 0 && idx < subs.length - 1) return;
          }
        }
        e.preventDefault();
        e.stopPropagation();
        const restored = getRestoredMainFocusTargetIfValid(mainEl);
        if (restored && focusElementSafe(restored)) {
          const bouquetScroll = restored.closest('.bouquet-inicio-scroll');
          if (bouquetScroll instanceof HTMLElement) {
            scrollElementIntoVisibleScrollAncestors(restored, bouquetScroll);
          } else {
            const stack = mainEl.querySelector('.home-content-stack');
            if (stack instanceof HTMLElement) {
              scrollElementIntoVisibleScrollAncestors(restored, stack);
            }
          }
          clearMainShellFocusMemory();
          return;
        }
        clearMainShellFocusMemory();
        const list = getVisibleFocusablesInContainer(mainEl);
        const target = list[0];
        if (target) focusElementSafe(target);
        return;
      }

      if (action === TV_ACTION.LEFT) {
        if (active.closest('.home-ad-zone')) return;
        if (active.closest('[data-home-spatial-delegate="true"]')) return;
        if (!mainEl.contains(active)) return;

        const path = location.pathname || '';
        // Buscador: LRUD del header y grilla de resultados lo gestiona useSearchPageTvNav.
        if (path === '/home/buscador' && active.closest('.search-page')) {
          return;
        }
        const bouquetScrollRoot =
          path === '/home/inicio' || path === '/home/servicios-tv-radio'
            ? document.querySelector('.bouquet-inicio-scroll')
            : null;
        const fromBouquetRowLeftEdge =
          bouquetScrollRoot instanceof HTMLElement &&
          isLeftmostChannelCardInInicioWall(active, bouquetScrollRoot);
        const fromVodRailLeftEdge =
          path === '/home/inicio' &&
          bouquetScrollRoot instanceof HTMLElement &&
          isLeftmostVodRecommendedRailFocusable(active, bouquetScrollRoot);
        const vodContent = path === '/home/vod' ? document.querySelector('.vod-page .vod-content') : null;
        const fromVodPageRowLeftEdge =
          vodContent instanceof HTMLElement && isLeftmostVodCardInVodPage(active, vodContent);

        const list = getVisibleFocusablesInContainer(mainEl);
        const fromFirstMainFocusable = list.length > 0 && list[0] === active;

        if (
          !fromBouquetRowLeftEdge &&
          !fromVodRailLeftEdge &&
          !fromVodPageRowLeftEdge &&
          !fromFirstMainFocusable
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        rememberMainShellFocus(active);
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
