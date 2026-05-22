import { useEffect, useRef } from 'react';

/**
 * Convierte la rueda vertical del ratón en desplazamiento horizontal del contenedor.
 * En los bordes del carril deja propagar el evento (scroll vertical de la página).
 *
 * @returns {import('react').RefObject<HTMLDivElement | null>}
 */
export function useHorizontalWheelScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 1) return;

      const delta = e.deltaY;
      if (delta === 0) return;

      const goingForward = delta > 0;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= maxScroll - 1;

      if ((goingForward && atEnd) || (!goingForward && atStart)) return;

      e.preventDefault();
      el.scrollLeft += delta;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return ref;
}

export default useHorizontalWheelScroll;
