import { useCallback, useEffect, useRef } from 'react';
import { useDevice } from '../../contexts/DeviceContext';

const RING_INSET_PX = 4;

function isFocusRingTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'button' || tag === 'select' || tag === 'textarea') return true;
  if (tag === 'a' && el.getAttribute('href')) return true;
  if (el.getAttribute('role') === 'button') return true;
  if (typeof el.tabIndex === 'number' && el.tabIndex >= 0) return true;
  return false;
}

function isFocusEnabled() {
  try {
    return document.documentElement.getAttribute('data-focus') !== 'off';
  } catch {
    return true;
  }
}

/**
 * Anillo de foco único en TV (10-foot). Sigue `document.activeElement` sin escalar cada tarjeta.
 */
export function TvFocusRing() {
  const { isTV } = useDevice();
  const ringRef = useRef(null);
  const targetRef = useRef(null);
  const rafRef = useRef(null);

  const hideRing = useCallback(() => {
    const ring = ringRef.current;
    if (!ring) return;
    ring.classList.remove('tv-focus-ring--visible');
    targetRef.current = null;
  }, []);

  const positionRing = useCallback(
    (el) => {
      const ring = ringRef.current;
      if (!ring) return;
      if (!(el instanceof HTMLElement) || !isFocusRingTarget(el)) {
        hideRing();
        return;
      }
      if (targetRef.current === el && ring.classList.contains('tv-focus-ring--visible')) {
        return;
      }
      try {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) {
          hideRing();
          return;
        }
        const pad = RING_INSET_PX;
        ring.style.width = `${r.width + pad * 2}px`;
        ring.style.height = `${r.height + pad * 2}px`;
        ring.style.transform = `translate3d(${Math.round(r.left - pad)}px, ${Math.round(r.top - pad)}px, 0)`;
        ring.classList.add('tv-focus-ring--visible');
        targetRef.current = el;
      } catch {
        hideRing();
      }
    },
    [hideRing]
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

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    syncFromActive();

    return () => {
      root.removeAttribute('data-tv-focus-ring');
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      hideRing();
    };
  }, [isTV, hideRing, positionRing, scheduleUpdate]);

  if (!isTV) return null;

  return <div ref={ringRef} className="tv-focus-ring" aria-hidden="true" />;
}

export default TvFocusRing;
