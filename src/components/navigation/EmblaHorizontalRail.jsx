import { Children, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useEmblaCarousel from 'embla-carousel-react';
import { useDevice } from '../../contexts/DeviceContext';

const EMBLA_OPTIONS = {
  axis: 'x',
  align: 'start',
  containScroll: 'trimSnaps',
  dragFree: false,
  duration: 22,
};

/** TV o layout multi-fila: scroll nativo sin Embla. */
function NativeHorizontalRail({ className = '', children, ...rest }) {
  return (
    <div className={className} data-native-horizontal-rail {...rest}>
      {children}
    </div>
  );
}

function EmblaRailWithArrows({ className = '', children, ...rest }) {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel(EMBLA_OPTIONS);
  const slides = Children.toArray(children);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const syncArrows = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return undefined;
    syncArrows();
    emblaApi.on('select', syncArrows);
    emblaApi.on('reInit', syncArrows);
    return () => {
      emblaApi.off('select', syncArrows);
      emblaApi.off('reInit', syncArrows);
    };
  }, [emblaApi, syncArrows]);

  useEffect(() => {
    const hideViewportScrollbar = () => {
      const node = emblaRef.current;
      if (!node) return;
      node.style.overflow = 'hidden';
      node.style.overflowX = 'hidden';
      node.style.overflowY = 'hidden';
      node.style.scrollbarWidth = 'none';
      node.style.msOverflowStyle = 'none';
    };
    hideViewportScrollbar();
    if (!emblaApi) return undefined;
    emblaApi.on('reInit', hideViewportScrollbar);
    emblaApi.on('scroll', hideViewportScrollbar);
    return () => {
      emblaApi.off('reInit', hideViewportScrollbar);
      emblaApi.off('scroll', hideViewportScrollbar);
    };
  }, [emblaRef, emblaApi, slides.length]);

  const viewportClass = ['embla-viewport', 'bouquet-embla-no-scrollbar', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="embla-rail-wrap">
      <button
        type="button"
        className="embla-rail-bar embla-rail-bar--prev"
        disabled={!canPrev}
        aria-label={t('bouquet.scrollPrev', { defaultValue: 'Ver anteriores' })}
        onClick={() => emblaApi?.scrollPrev()}
      >
        <span className="embla-rail-bar-icon" aria-hidden="true">
          ‹
        </span>
      </button>
      <div ref={emblaRef} className={viewportClass} data-embla-viewport {...rest}>
        <div className="embla-container">
          {slides.map((child, index) => (
            <div className="embla-slide" key={child?.key ?? `slide-${index}`}>
              {child}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="embla-rail-bar embla-rail-bar--next"
        disabled={!canNext}
        aria-label={t('bouquet.scrollNext', { defaultValue: 'Ver siguientes' })}
        onClick={() => emblaApi?.scrollNext()}
      >
        <span className="embla-rail-bar-icon" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  );
}

/**
 * Carril horizontal: Embla + flechas solo en PC; en TV scroll nativo (sin cambios de navegación).
 */
export function EmblaHorizontalRail({ className = '', children, useNativeScroll = false, ...rest }) {
  const { isPC } = useDevice();

  const nativeScroll = useMemo(
    () => !isPC || useNativeScroll,
    [isPC, useNativeScroll]
  );

  if (nativeScroll) {
    return (
      <NativeHorizontalRail className={className} {...rest}>
        {children}
      </NativeHorizontalRail>
    );
  }

  return (
    <EmblaRailWithArrows className={className} {...rest}>
      {children}
    </EmblaRailWithArrows>
  );
}

export default EmblaHorizontalRail;
