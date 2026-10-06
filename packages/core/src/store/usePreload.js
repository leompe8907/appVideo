import { usePreloadStore } from './preloadStore';

/**
 * Hook de compatibilidad: expone la misma API que `usePreload()` del contexto
 * para permitir migración incremental sin acoplar componentes a Zustand.
 */
export function usePreload() {
  const epg = usePreloadStore((s) => s.epg);
  const vod = usePreloadStore((s) => s.vod);
  const ads = usePreloadStore((s) => s.ads);
  const catchup = usePreloadStore((s) => s.catchup);

  const loadEPG = usePreloadStore((s) => s.loadEPG);
  const loadVOD = usePreloadStore((s) => s.loadVOD);
  const loadAds = usePreloadStore((s) => s.loadAds);
  const loadCatchup = usePreloadStore((s) => s.loadCatchup);
  const resetPreload = usePreloadStore((s) => s.resetPreload);
  const getStreamsWithEPG = usePreloadStore((s) => s.getStreamsWithEPG);

  return {
    epg,
    loadEPG,
    vod,
    loadVOD,
    ads,
    loadAds,
    catchup,
    loadCatchup,
    resetPreload,
    getStreamsWithEPG,
  };
}

export default usePreload;

