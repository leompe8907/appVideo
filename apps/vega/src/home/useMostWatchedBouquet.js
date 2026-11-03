import {useEffect, useRef, useState} from 'react';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {buildMostWatchedItems, getTopChannelsGlobal, isTelemetryEnabled} from '@appvideo/core/services/mostWatchedChannelsService';
import {devLog} from '../devLog';

/**
 * Bouquet sintético "Más vistos" (useMostWatchedBouquet de la web): ranking
 * del backend de la marca (`login.telemetry.enabled`, hoy Wind) cruzado con
 * los canales del preload. Necesita la sesión de dispositivo; si algo falla
 * devuelve null y el home sigue igual.
 */
export function useMostWatchedBouquet() {
  const brand = getActiveBrandConfig();
  const enabled = isTelemetryEnabled(brand);
  const epgStatus = usePreloadStore((s) => s.epg.status);
  const [bouquet, setBouquet] = useState(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!enabled || epgStatus !== 'ready' || requested.current) return undefined;
    requested.current = true;
    let cancelled = false;
    (async () => {
      try {
        const response = await getTopChannelsGlobal(brand, brand?.brand);
        if (cancelled || !response) {
          devLog('más vistos: sin respuesta del backend');
          return;
        }
        // Canales del momento de la respuesta (no se re-dispara si el EPG se recarga).
        const items = buildMostWatchedItems(response, usePreloadStore.getState().epg.streams || []);
        devLog(`más vistos: ${items.length} canales`);
        if (!cancelled && items.length > 0) {
          setBouquet({
            bouquetId: 'most-watched',
            name: i18n.t('bouquet.mostWatched', {defaultValue: 'Más vistos'}),
            priority: response.priority,
            isMain: response.isMain,
            customData: response.customData ?? null,
            items,
          });
        }
      } catch (e) {
        devLog('más vistos: error', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, epgStatus, brand]);

  return bouquet;
}
