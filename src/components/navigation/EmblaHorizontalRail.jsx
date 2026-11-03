import { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useEmblaCarousel from 'embla-carousel-react';
import { useDevice } from '../../contexts/DeviceContext';

const EMBLA_OPTIONS = {
  axis: 'x',
  align: 'start',
  containScroll: 'trimSnaps',
  dragFree: false,
  duration: 22,
  // `watchResize` (default `true` en embla-carousel@8.6.0) hace que Embla
  // observe con SU PROPIO ResizeObserver el viewport Y cada `.embla-slide`
  // por separado, y llame a `reInit()` ante cualquier cambio de tamaño
  // (`node_modules/embla-carousel/esm/embla-carousel.esm.js`, función
  // `ResizeHandler`/`S`). `reInit()` (función `A`) destruye el drag handler
  // y la animación en curso (`F()`) y los reconstruye desde cero (`M()`) --
  // si el usuario todavía tiene el botón del mouse apretado en ese momento
  // (media-arrastre), el handler reconstruido NO recibe ese `pointerdown`
  // (los listeners de `mousemove`/`mouseup` solo se agregan DENTRO del
  // handler de `pointerdown`), así que el arrastre queda completamente sin
  // respuesta hasta soltar el botón y empezar un gesto nuevo -- esto es lo
  // que se sentía como "se traba" al arrastrar el carril.
  //
  // Acá se desactiva porque no hace falta: el ancho de cada tarjeta es fijo
  // por CSS (`--bouquet-cell-width` en `_bouquet.scss`, ver `.embla-slide {
  // flex: 0 0 var(--bouquet-cell-width) }`) y no depende del contenido (las
  // imágenes de logo/evento cargan DENTRO de una caja de tamaño ya fijado,
  // nunca la agrandan). El único resize real que puede pasar es un resize
  // de ventana/zoom del navegador, que se maneja abajo a mano con un solo
  // listener (debounced y sin interrumpir un drag en curso).
  watchResize: false,
};

/** TV o layout multi-fila: scroll nativo sin Embla. */
function NativeHorizontalRail({ className = '', children, ...rest }) {
  return (
    <div className={className} data-native-horizontal-rail {...rest}>
      {children}
    </div>
  );
}

/**
 * Llama `emblaApi.reInit()`, pero sin interrumpir un drag en curso: si
 * `dragHandler.pointerDown()` (API pública de embla-carousel, ver
 * `internalEngine()`) devuelve `true`, el usuario todavía tiene el botón
 * del mouse apretado -- reInit ahora mismo destruiría el drag handler a
 * mitad de gesto (ver comentario en `EMBLA_OPTIONS.watchResize`). En vez de
 * eso, se espera al evento `'pointerUp'` (evento real emitido por Embla
 * cuando el usuario suelta el botón) y se reintenta una sola vez ahí.
 */
function reInitSafely(emblaApi) {
  if (!emblaApi) return;
  const isDragging = Boolean(emblaApi.internalEngine?.().dragHandler?.pointerDown?.());
  if (!isDragging) {
    emblaApi.reInit();
    return;
  }
  const onPointerUp = () => {
    emblaApi.off('pointerUp', onPointerUp);
    emblaApi.reInit();
  };
  emblaApi.on('pointerUp', onPointerUp);
}

function EmblaRailWithArrows({ className = '', children, ...rest }) {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel(EMBLA_OPTIONS);
  const slides = Children.toArray(children);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // `emblaRef` (alias interno `setViewport` en embla-carousel-react) es un
  // CALLBACK ref -- un setter de estado, no un ref-objeto -- así que NO tiene
  // `.current`. Hace falta un ref propio para quedarse con el nodo DOM real
  // del viewport (ver setViewportRef más abajo).
  const viewportNodeRef = useRef(null);
  const setViewportRef = useCallback(
    (node) => {
      emblaRef(node);
      viewportNodeRef.current = node;
    },
    [emblaRef]
  );

  // Expone la instancia de Embla en su propio nodo DOM (ya tiene
  // `data-embla-viewport`) para que código fuera de React -- ej.
  // homeShellNavigation.js, al restaurar el foco tras cerrar el player --
  // pueda llevar una tarjeta a la vista sin necesitar el hook. Embla mueve
  // las tarjetas con `transform` sobre un contenedor `overflow: hidden` (ver
  // EMBLA_OPTIONS/SCSS), así que `scrollLeft` no sirve acá.
  useEffect(() => {
    const node = viewportNodeRef.current;
    if (!node) return undefined;
    node.__emblaApi = emblaApi || null;
    return () => {
      if (node.__emblaApi === emblaApi) node.__emblaApi = null;
    };
  }, [emblaApi]);

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

  // Recalcular snaps/flechas cuando cambia el contenido (nuevo bouquet, etc).
  useEffect(() => {
    if (!emblaApi) return undefined;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        reInitSafely(emblaApi);
        syncArrows();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [emblaApi, slides.length, syncArrows]);

  // Único caso real de resize que `watchResize:false` deja de cubrir: la
  // ventana del navegador cambia de tamaño (o zoom), lo que sí puede alterar
  // `--bouquet-cell-width` si esa variable depende de un media query. Un
  // solo listener a nivel window, debounced, y protegido contra interrumpir
  // un drag en curso vía `reInitSafely`.
  useEffect(() => {
    if (!emblaApi) return undefined;
    let timeoutId = null;
    const onWindowResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        reInitSafely(emblaApi);
        syncArrows();
      }, 150);
    };
    window.addEventListener('resize', onWindowResize);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', onWindowResize);
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
    // Solo en 'reInit' (Embla reconstruye el DOM/estilos internos ahí, así
    // que puede pisar esto). El listener de 'scroll' que había antes
    // reescribía estas mismas 5 propiedades inline en CADA evento de scroll
    // -- que Embla dispara de forma continua durante el drag/momentum --
    // trabajo de main-thread innecesario justo durante el gesto de scroll
    // (nada en un evento 'scroll' puede resetear un `style` inline puesto a
    // mano, así que nunca hacía falta reaplicarlo ahí).
    emblaApi.on('reInit', hideViewportScrollbar);
    return () => {
      emblaApi.off('reInit', hideViewportScrollbar);
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
      <div ref={setViewportRef} className={viewportClass} data-embla-viewport {...rest}>
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
