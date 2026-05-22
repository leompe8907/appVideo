import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import { usePreload } from '../store/usePreload';
import { getTvActionFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { shouldDeferHomeShellNavigation } from '../utils/homeShellOverlays';
import {
  focusElementSafe,
  scrollElementIntoVisibleScrollAncestors,
  scrollFocusIntoBouquetMuro,
  getVisibleFocusablesInContainer,
} from '../utils/homeShellNavigation';
import { buildInicioBouquetChannelRows, findChannelCardCellInRows } from '../utils/inicioBouquetTvGrid';

const ROUTES = {
  inicio: { pathname: '/home/inicio', bridgesVodAndInnerAds: true },
  serviciosTvRadio: { pathname: '/home/servicios-tv-radio', bridgesVodAndInnerAds: false },
};

/**
 * Navegación en el muro de bouquets: TV (mando), teclado (←→↑↓) y Tab; scroll al foco.
 * Puentes con ads solo en modo TV.
 *
 * @param {{ route: 'inicio' | 'serviciosTvRadio'; scrollRootSelector?: string }} opts
 */
export function useBouquetMuroTvNav(opts) {
  const route = opts?.route ?? 'inicio';
  const cfg = ROUTES[route] || ROUTES.inicio;
  const { isTV } = useDevice();
  const location = useLocation();
  const scrollRootSelector = opts?.scrollRootSelector || '.bouquet-inicio-scroll';
  const epg = usePreload((s) => s.epg);
  const epgWallKey =
    epg.status === 'ready'
      ? `ready:${(epg.bouquetsWithChannels || []).length}`
      : `other:${epg.status}`;
  const wallFocusPlacedRef = useRef(false);
  const targetPath = cfg.pathname;
  const bridgesVod = Boolean(cfg.bridgesVodAndInnerAds);

  useEffect(() => {
    if (location.pathname !== targetPath) {
      wallFocusPlacedRef.current = false;
    }
  }, [location.pathname, targetPath]);

  /** TV: al entrar en la ruta, foco en la primera tarjeta del muro. */
  useLayoutEffect(() => {
    if (!isTV) return undefined;
    if (location.pathname !== targetPath) return undefined;
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
            scrollFocusIntoBouquetMuro(first, scrollRoot);
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
  }, [isTV, location.pathname, scrollRootSelector, epgWallKey, targetPath]);

  useLayoutEffect(() => {
    if (location.pathname !== targetPath) return undefined;

    const scrollRoot = document.querySelector(scrollRootSelector);
    if (!(scrollRoot instanceof HTMLElement)) return undefined;

    const queryMainContent = () =>
      document.querySelector('main.home-content[data-home-scope="content"]');
    const queryContentStack = () => queryMainContent()?.querySelector?.('.home-content-stack') ?? null;

    const onFocusIn = (e) => {
      if (shouldDeferHomeShellNavigation()) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const card = t.closest('.channel-card');
      if (card && scrollRoot.contains(card)) {
        const wall = scrollRoot.querySelector('.bouquet-wall');
        if (wall?.contains(card)) {
          scrollFocusIntoBouquetMuro(card, scrollRoot);
          return;
        }
      }
      if (
        bridgesVod &&
        t.closest('.bouquet-vod-recommended .vod-row-cards') &&
        scrollRoot.contains(t)
      ) {
        scrollFocusIntoBouquetMuro(t, scrollRoot);
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

      const main = queryMainContent();
      const stack = queryContentStack();

      if (
        isTV &&
        action === TV_ACTION.DOWN &&
        active.closest('.home-ad-zone[data-ad-zone="top"]')
      ) {
        const firstCard = scrollRoot.querySelector('.bouquet-wall .channel-card');
        if (firstCard instanceof HTMLElement) {
          e.preventDefault();
          e.stopPropagation();
          focusElementSafe(firstCard);
          scrollFocusIntoBouquetMuro(firstCard, scrollRoot);
        }
        return;
      }

      if (isTV && action === TV_ACTION.UP && active.closest('.home-ad-zone[data-ad-zone="bottom"]')) {
        if (bridgesVod) {
          const vodRow = scrollRoot.querySelector('.bouquet-vod-recommended .vod-row-cards');
          if (vodRow instanceof HTMLElement) {
            const list = getVisibleFocusablesInContainer(vodRow);
            const target = list[0];
            if (target instanceof HTMLElement) {
              e.preventDefault();
              e.stopPropagation();
              focusElementSafe(target);
              scrollFocusIntoBouquetMuro(target, scrollRoot);
            }
          }
        } else {
          const wallEl = scrollRoot.querySelector('.bouquet-wall');
          if (wallEl instanceof HTMLElement) {
            const rows2 = buildInicioBouquetChannelRows(wallEl);
            if (rows2.length) {
              const lastRow = rows2[rows2.length - 1];
              const targetCard = lastRow[0];
              if (targetCard instanceof HTMLElement) {
                e.preventDefault();
                e.stopPropagation();
                focusElementSafe(targetCard);
                scrollFocusIntoBouquetMuro(targetCard, scrollRoot);
              }
            }
          }
        }
        return;
      }

      if (
        isTV &&
        bridgesVod &&
        action === TV_ACTION.DOWN &&
        scrollRoot.contains(active)
      ) {
        const vodRail = scrollRoot.querySelector('.bouquet-vod-recommended .vod-row-cards');
        if (vodRail instanceof HTMLElement && vodRail.contains(active)) {
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
      }

      if (bridgesVod) {
        const vodRail = scrollRoot.querySelector('.bouquet-vod-recommended .vod-row-cards');
        if (vodRail instanceof HTMLElement && vodRail.contains(active)) {
          const list = getVisibleFocusablesInContainer(vodRail);
          const vi = list.indexOf(active);
          if (vi >= 0) {
            if (action === TV_ACTION.RIGHT && vi + 1 < list.length) {
              e.preventDefault();
              e.stopPropagation();
              const t = list[vi + 1];
              focusElementSafe(t);
              scrollFocusIntoBouquetMuro(t, scrollRoot);
              return;
            }
            if (action === TV_ACTION.LEFT && vi > 0) {
              e.preventDefault();
              e.stopPropagation();
              const t = list[vi - 1];
              focusElementSafe(t);
              scrollFocusIntoBouquetMuro(t, scrollRoot);
              return;
            }
            if (action === TV_ACTION.UP) {
              const wall = scrollRoot.querySelector('.bouquet-wall');
              if (wall instanceof HTMLElement) {
                const rows = buildInicioBouquetChannelRows(wall);
                if (rows.length) {
                  const lastRow = rows[rows.length - 1];
                  const ti = Math.min(vi, lastRow.length - 1);
                  const tc = lastRow[ti];
                  if (tc instanceof HTMLElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    focusElementSafe(tc);
                    scrollFocusIntoBouquetMuro(tc, scrollRoot);
                    return;
                  }
                }
              }
            }
          }
        }
      }

      if (!scrollRoot.contains(active)) return;

      const card = active.closest('.channel-card');
      if (!card || !scrollRoot.contains(card)) return;

      const wall = scrollRoot.querySelector('.bouquet-wall');
      if (!wall || !wall.contains(card)) return;

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

      if (isTV && !target && action === TV_ACTION.UP && pos.ri === 0) {
        let topZone = scrollRoot.querySelector('.home-ad-zone[data-ad-zone="top"]');
        if (!(topZone instanceof HTMLElement)) {
          topZone = main?.querySelector?.('.home-ad-zone[data-ad-zone="top"]') ?? null;
        }
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

      if (
        bridgesVod &&
        !target &&
        action === TV_ACTION.DOWN &&
        pos.ri === rows.length - 1
      ) {
        const vodRow = scrollRoot.querySelector('.bouquet-vod-recommended .vod-row-cards');
        if (vodRow instanceof HTMLElement) {
          const list = getVisibleFocusablesInContainer(vodRow);
          const v0 = list[0];
          if (v0 instanceof HTMLElement) {
            e.preventDefault();
            e.stopPropagation();
            focusElementSafe(v0);
            scrollFocusIntoBouquetMuro(v0, scrollRoot);
          }
        }
        return;
      }

      if (
        isTV &&
        !bridgesVod &&
        !target &&
        action === TV_ACTION.DOWN &&
        pos.ri === rows.length - 1
      ) {
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
        scrollFocusIntoBouquetMuro(target, scrollRoot);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    scrollRoot.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      scrollRoot.removeEventListener('focusin', onFocusIn, true);
    };
  }, [isTV, location.pathname, scrollRootSelector, targetPath, bridgesVod]);
}

export default useBouquetMuroTvNav;
