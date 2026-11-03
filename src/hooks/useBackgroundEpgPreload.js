import { useEffect } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { usePreloadStore } from '@appvideo/core/store/preloadStore';

/**
 * Si la app abre directo en una sección que no pasa por el preload (la última
 * ruta guardada, p. ej. /home/catchup), empieza a bajar la EPG en segundo
 * plano. Sin esto, la primera vez que se entra a Inicio o a la Guía el
 * `PreloadGate` manda a /preload y hay que esperar la carga completa ahí.
 */
export function useBackgroundEpgPreload() {
  const { currentBrand } = useBrand();
  const status = usePreloadStore((s) => s.epg.status);
  const loadEPG = usePreloadStore((s) => s.loadEPG);

  useEffect(() => {
    if (currentBrand && status === 'idle') loadEPG(currentBrand);
  }, [currentBrand, status, loadEPG]);
}

export default useBackgroundEpgPreload;
