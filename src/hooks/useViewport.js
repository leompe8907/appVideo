import { useState, useEffect } from 'react';

/**
 * Hook para detectar el tamaño de la ventana y cambios en tiempo real
 * Útil para ajustar la UI según la resolución sin necesidad de refrescar
 */
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isHD: false,
    isFullHD: false,
    isUltraHD: false,
    is4K: false,
    is8K: false,
    scale: 1,
  });

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Determinar resolución
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024 && width < 1920;
      const isHD = width >= 1280 && width < 1920;
      const isFullHD = width >= 1920 && width < 2560;
      const isUltraHD = width >= 2560 && width < 3840;
      const is4K = width >= 3840 && width < 7680;
      const is8K = width >= 7680;

      // Calcular escala base (para TVs grandes, escalar desde Full HD)
      // Base: 1920x1080 (Full HD)
      let scale = 1;
      if (width >= 1920) {
        scale = width / 1920;
      } else if (width < 1920) {
        scale = width / 1920;
      }

      setViewport({
        width,
        height,
        isMobile,
        isTablet,
        isDesktop,
        isHD,
        isFullHD,
        isUltraHD,
        is4K,
        is8K,
        scale,
      });
    };

    // Actualizar al montar
    updateViewport();

    // Escuchar cambios de tamaño
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  return viewport;
}

/**
 * Hook simplificado para obtener solo el ancho
 */
export function useViewportWidth() {
  const { width } = useViewport();
  return width;
}

/**
 * Hook para obtener la escala recomendada
 */
export function useViewportScale() {
  const { scale } = useViewport();
  return scale;
}

