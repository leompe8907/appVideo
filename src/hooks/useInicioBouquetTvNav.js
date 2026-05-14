import { useBouquetMuroTvNav } from './useBouquetMuroTvNav';

/**
 * Navegación TV del muro en `/home/inicio` (incl. puentes ads/VOD).
 * @param {{ scrollRootSelector?: string }} [opts]
 */
export function useInicioBouquetTvNav(opts = {}) {
  useBouquetMuroTvNav({ route: 'inicio', ...opts });
}

export default useInicioBouquetTvNav;
