import { useCallback, useEffect, useRef } from 'react';
import { useDevice } from '../../contexts/DeviceContext';

const RING_INSET_PX = 4;
const CHANNEL_CARD_RING_INNER_SELECTORS = ['.channel-card-frame', '.channel-card-lwn-frame'];
const LAYOUT_ANCHOR_SELECTORS = [
  '.home-ad-zone',
  '.home-content-stack',
  'main.home-content[data-home-scope="content"]',
];

function isFocusRingTarget(el) {
  if (!el || typeof el.querySelector !== 'function') return false;
  try {
    if (el.closest('.home-sidebar')) return false;
  } catch {
    // noop
  }
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'button' || tag === 'select' || tag === 'textarea') return true;
  if (tag === 'a' && el.getAttribute('href')) return true;
  if (el.getAttribute('role') === 'button') return true;
  if (typeof el.tabIndex === 'number' && el.tabIndex >= 0) return true;
  return false;
}

/** Bouquet: el anillo sigue el marco visual (logo + evento), no toda la tarjeta con texto debajo. */
function resolveFocusRingTarget(el) {
  if (!el || typeof el.querySelector !== 'function') return el;
  if (el.classList.contains('home-ad-zone')) {
    const media = el.querySelector('.home-ad-media');
    if (media) return media;
    const slide = el.querySelector('.home-ad-slide');
    if (slide) return slide;
  }
  const inner = el.querySelector('.channel-card-frame, .channel-card-lwn-frame');
  if (inner) return inner;
  return el;
}

/** Contenedores cuyo resize desplaza hermanos (p. ej. publicidad → bouquet). */
function resolveLayoutAnchors(focusEl) {
  const anchors = new Set();
  if (!focusEl || typeof focusEl.querySelectorAll !== 'function') return anchors;

  try {
    for (const selector of LAYOUT_ANCHOR_SELECTORS) {
      document.querySelectorAll(selector).forEach((node) => {
        if (node) anchors.add(node);
      });
    }
    const scrollRoot = focusEl.closest('.bouquet-inicio-scroll, .vod-content, .home-content-outlet');
    if (scrollRoot) anchors.add(scrollRoot);
  } catch {
    // noop
  }

  return anchors;
}

function isFocusEnabled() {
  try {
    return document.documentElement.getAttribute('data-focus') !== 'off';
  } catch {
    return true;
  }
}

/** Reposiciona el anillo tras cambios de layout (p. ej. sidebar expandido). */
export function requestTvFocusRingSync() {
  try {
    window.dispatchEvent(new CustomEvent('tv-focus-ring-sync'));
  } catch {
    // noop
  }
}

/**
 * Anillo de foco único en TV (10-foot). Sigue `document.activeElement` sin escalar cada tarjeta.
 */
export function TvFocusRing() {
  const { isTV } = useDevice();
  const ringRef = useRef(null);
  const targetRef = useRef(null);
  const observedSetRef = useRef(new Set());
  const resizeObserverRef = useRef(null);
  const rafRef = useRef(null);

  const unobserveAll = useCallback(() => {
    const ro = resizeObserverRef.current;
    const observed = observedSetRef.current;
    if (ro) {
      for (const node of observed) {
        try {
          ro.unobserve(node);
        } catch {
          // noop
        }
      }
    }
    observed.clear();
  }, []);

  const observeLayoutContext = useCallback(
    (focusEl, visualTarget) => {
      const ro = resizeObserverRef.current;
      if (!ro) return;

      const next = new Set();
      if (visualTarget) next.add(visualTarget);
      resolveLayoutAnchors(focusEl).forEach((node) => next.add(node));

      const prev = observedSetRef.current;
      for (const node of prev) {
        if (!next.has(node)) {
          try {
            ro.unobserve(node);
          } catch {
            // noop
          }
        }
      }
      for (const node of next) {
        if (!prev.has(node)) {
          try {
            ro.observe(node);
          } catch {
            // noop
          }
        }
      }
      observedSetRef.current = next;
    },
    [],
  );

  const hideRing = useCallback(() => {
    const ring = ringRef.current;
    if (!ring) return;
    unobserveAll();
    ring.classList.remove('tv-focus-ring--visible');
    targetRef.current = null;
  }, [unobserveAll]);

  const positionRing = useCallback(
    (el) => {
      const ring = ringRef.current;
      if (!ring) return;
      if (!el || typeof el.getBoundingClientRect !== 'function' || !isFocusRingTarget(el)) {
        hideRing();
        return;
      }
      try {
        const visualTarget = resolveFocusRingTarget(el);
        const r = visualTarget.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) {
          hideRing();
          return;
        }
        const pad = RING_INSET_PX;
        const radius = window.getComputedStyle(visualTarget).borderRadius;
        ring.style.width = `${r.width + pad * 2}px`;
        ring.style.height = `${r.height + pad * 2}px`;
        ring.style.transform = `translate3d(${Math.round(r.left - pad)}px, ${Math.round(r.top - pad)}px, 0)`;
        ring.style.borderRadius = radius && radius !== '0px' ? radius : '10px';
        ring.classList.add('tv-focus-ring--visible');
        targetRef.current = el;
        observeLayoutContext(el, visualTarget);
      } catch {
        hideRing();
      }
    },
    [hideRing, observeLayoutContext],
  );

  const scheduleUpdate = useCallback(
    (el) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        positionRing(el);
      });
    },
    [positionRing]
  );

  useEffect(() => {
    if (!isTV) return undefined;

    const root = document.documentElement;
    root.setAttribute('data-tv-focus-ring', 'on');

    resizeObserverRef.current = new ResizeObserver(() => {
      if (targetRef.current) scheduleUpdate(targetRef.current);
    });

    const syncFromActive = () => {
      if (!isFocusEnabled()) {
        hideRing();
        return;
      }
      const active = document.activeElement;
      if (isFocusRingTarget(active)) {
        positionRing(active);
      } else {
        hideRing();
      }
    };

    const onFocusIn = (e) => {
      if (!isFocusEnabled()) return;
      const el = e.target;
      if (!isFocusRingTarget(el)) return;
      positionRing(el);
    };

    const onFocusOut = (e) => {
      const next = e.relatedTarget;
      if (isFocusRingTarget(next)) {
        positionRing(next);
        return;
      }
      requestAnimationFrame(syncFromActive);
    };

    const onScroll = () => {
      if (targetRef.current) scheduleUpdate(targetRef.current);
    };

    const onResize = () => {
      if (targetRef.current) scheduleUpdate(targetRef.current);
    };

    const onSync = () => {
      if (targetRef.current) {
        positionRing(targetRef.current);
        return;
      }
      syncFromActive();
    };

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('tv-focus-ring-sync', onSync);
    syncFromActive();

    return () => {
      root.removeAttribute('data-tv-focus-ring');
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('tv-focus-ring-sync', onSync);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      hideRing();
    };
  }, [isTV, hideRing, positionRing, scheduleUpdate]);

  if (!isTV) return null;

  return <div ref={ringRef} className="tv-focus-ring" aria-hidden="true" />;
}

export default TvFocusRing;
