/**
 * Bouquet sintético "Más vistos" -- ranking global de canales OTT que
 * calcula el backend Wind (ver `telemetry` app en Back-Wind-V2 y
 * `services/mostWatchedChannelsService.js` en este repo).
 *
 * No inyecta entradas en `epg.bouquetsWithChannels` -- solo cruza el
 * ranking contra `epg.streams` ya cargado por el preload (mismo patrón que
 * `VodRecommendedHomeRail`) y arma un objeto con el MISMO shape que un
 * bouquet real (`bouquetId`, `name`, `priority`, `isMain`, `customData`,
 * `items`). `BouquetWall.jsx` lo mezcla con los bouquets reales y lo pasa
 * por `sortBouquetsByPriority` (`tvDataService.js`) antes de renderizar --
 * así "Más vistos" compite por posición según su `priority` real en vez de
 * quedar siempre fijo al final, y se renderiza con el mismo
 * `BouquetHorizontalGrid`/`BouquetGridVertical` que cualquier otro bouquet
 * (sin un componente de render aparte).
 *
 * Se activa por brand (`login.telemetry.enabled` en `brands.js`, hoy solo
 * Wind). Si el brand no lo activa, el usuario no tiene sesión de
 * dispositivo, la llamada falla, o el ranking no cruza con ningún canal del
 * lineup actual, este hook devuelve `null` -- nunca rompe la página.
 *
 * @returns {{bouquetId: string, name: string, priority?: *, isMain?: *, customData?: *, items: Array} | null}
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';
import {
  buildMostWatchedItems,
  getTopChannelsGlobal,
  isTelemetryEnabled,
} from '../services/mostWatchedChannelsService';

export function useMostWatchedBouquet() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { epg } = usePreload();
  const [bouquet, setBouquet] = useState(null);
  const requestedRef = useRef(false);

  const brand = currentBrand?.brand;
  const enabled = isTelemetryEnabled(currentBrand);

  useEffect(() => {
    // Reintentar si cambia de brand (p. ej. host multi-marca).
    requestedRef.current = false;
    setBouquet(null);
  }, [brand]);

  useEffect(() => {
    if (!enabled) return;
    if (epg.status !== 'ready') return;
    if (requestedRef.current) return;
    requestedRef.current = true;

    let cancelled = false;
    (async () => {
      const response = await getTopChannelsGlobal(currentBrand, brand);
      if (cancelled || !response) return;
      const matched = buildMostWatchedItems(response, epg.streams);
      if (!cancelled && matched.length > 0) {
        setBouquet({
          bouquetId: 'most-watched',
          name: t('bouquet.mostWatched', { defaultValue: 'Más vistos' }),
          priority: response.priority,
          isMain: response.isMain,
          customData: response.customData ?? null,
          items: matched,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, epg.status, epg.streams, currentBrand, brand]);

  return bouquet;
}

export default useMostWatchedBouquet;
