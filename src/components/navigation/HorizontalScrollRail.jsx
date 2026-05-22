import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll';

/**
 * Contenedor con scroll horizontal: la rueda del ratón desplaza el carril sin Shift.
 * Compatible con navegación TV existente (foco + scrollIntoView en ancestros).
 */
export function HorizontalScrollRail({ className, children, ...rest }) {
  const scrollRef = useHorizontalWheelScroll();

  return (
    <div ref={scrollRef} className={className} data-horizontal-scroll-rail {...rest}>
      {children}
    </div>
  );
}

export default HorizontalScrollRail;
