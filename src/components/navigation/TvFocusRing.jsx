import { useCallback, useEffect, useRef } from 'react';
import { useDevice } from '../../contexts/DeviceContext';

const RING_INSET_PX = 4;
const CHANNEL_CARD_RING_INNER_SELECTORS = ['.channel-card-frame', '.channel-card-lwn-frame'];

function isFocusRingTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
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
  if (!(el instanceof HTMLElement)) return el;
  if (el.classList.contains('home-ad-zone')) {
    const media = el.querySelector('.home-ad-media');
    if (media instanceof HTMLElement) return media;
    const slide = el.querySelector('.home-ad-slide');
    if (slide instanceof HTMLElement) return slide;
  }
  if (!el.classList.contains('channel-card')) return el;
  for (const selector of CHANNEL_CARD_RING_INNER_SELECTORS) {
    const inner = el.querySelector(selector);
    if (inner instanceof HTMLElement) return inner;
  }
  return el;
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
  const observedVisualRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const rafRef = useRef(null);

  const unobserveVisualTarget = useCallback(() => {
    const ro = resizeObserverRef.current;
    const observed = observedVisualRef.current;
    if (ro && observed instanceof HTMLElement) {
      try {
        ro.unobserve(observed);
      } catch {
        // noop
      }
    }
    observedVisualRef.current = null;
  }, []);

  const observeVisualTarget = useCallback(
    (visualTarget) => {
      const ro = resizeObserverRef.current;
      if (!ro) return;
      if (observedVisualRef.current === visualTarget) return;
      unobserveVisualTarget();
      if (visualTarget instanceof HTMLElement) {
        observedVisualRef.current = visualTarget;
        try {
          ro.observe(visualTarget);
        } catch {
          observedVisualRef.current = null;
        }
      }
    },
    [unobserveVisualTarget],
  );

  const hideRing = useCallback(() => {
    const ring = ringRef.current;
    if (!ring) return;
    unobserveVisualTarget();
    ring.classList.remove('tv-focus-ring--visible');
    targetRef.current = null;
  }, [unobserveVisualTarget]);

  const positionRing = useCallback(
    (el) => {
      const ring = ringRef.current;
      if (!ring) return;
      if (!(el instanceof HTMLElement) || !isFocusRingTarget(el)) {
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
        observeVisualTarget(visualTarget);
      } catch {
        hideRing();
      }
    },
    [hideRing, observeVisualTarget],
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
