/**
 * Riel "Más vistos" en Inicio -- ranking global de canales OTT que calcula
 * el backend Wind (ver `telemetry` app en Back-Wind-V2 y
 * `services/mostWatchedChannelsService.js` en este repo).
 *
 * Independiente del muro de bouquets real (`BouquetWall`): no inyecta
 * entradas sintéticas en `epg.bouquetsWithChannels`, solo cruza el ranking
 * contra `epg.streams` ya cargado por el preload (mismo patrón que
 * `VodRecommendedHomeRail`). Reutiliza `ChannelCard` de `BouquetLayouts.jsx`
 * para que las tarjetas se vean igual que en el resto del muro.
 *
 * Se activa por brand (`login.telemetry.enabled` en `brands.js`, hoy solo
 * Wind). Si el brand no lo activa, el usuario no tiene sesión de
 * dispositivo, la llamada falla, o el ranking no cruza con ningún canal del
 * lineup actual, este componente no renderiza nada -- nunca rompe la
 * página ni muestra un estado de error.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { useDevice } from '../../contexts/DeviceContext';
import { usePreload } from '../../store/usePreload';
import { getBouquetHorizontalGridClasses } from '../../utils/bouquetLayoutClasses';
import { resolveBouquetLayoutForDevice } from '../../utils/bouquetLayoutConfig';
import { EmblaHorizontalRail } from '../navigation/EmblaHorizontalRail';
import { ChannelCard } from './BouquetLayouts';
import {
  buildMostWatchedItems,
  getTopChannelsGlobal,
  isTelemetryEnabled,
} from '../../services/mostWatchedChannelsService';

export function MostWatchedRail({ onChannelSelect, onChannelFocus }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { isTV, isPC } = useDevice();
  const { epg } = usePreload();
  const [items, setItems] = useState([]);
  // `customData` del endpoint de ranking (`getTopChannelsGlobal`) -- ahora el
  // backend Wind ya devuelve el ranking con forma de bouquet (bouquetId,
  // name, customData, channels), igual que cualquier otro bouquet real. Se
  // guarda acá para resolver el diseño de tarjeta con la MISMA lógica que
  // `BouquetWall.jsx` (`resolveBouquetLayoutForDevice`), en vez de dejar el
  // diseño sin definir (lo que antes caía siempre a la variante 'logo' por
  // default en `getChannelLayoutVariant`).
  const [customData, setCustomData] = useState(null);
  const requestedRef = useRef(false);

  const brand = currentBrand?.brand;
  const enabled = isTelemetryEnabled(currentBrand);

  useEffect(() => {
    // Reintentar si cambia de brand (p. ej. host multi-marca).
    requestedRef.current = false;
    setItems([]);
    setCustomData(null);
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
        setItems(matched);
        setCustomData(response.customData ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, epg.status, epg.streams, currentBrand, brand]);

  if (!enabled || items.length === 0) return null;

  const layout = resolveBouquetLayoutForDevice({ customData }, { isTV, isPC });
  const { root: rootClass, track: trackClass } = getBouquetHorizontalGridClasses(layout.cardDesign);

  return (
    <div className={rootClass} data-bouquet-id="most-watched" data-layout={layout.cardDesign ?? ''}>
      <h4 className="bouquet-heading">
        {t('bouquet.mostWatched', { defaultValue: 'Más vistos' })}
      </h4>
      <EmblaHorizontalRail className={trackClass}>
        {items.map((channel, index) => (
          <ChannelCard
            key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
            channel={channel}
            layoutType={layout.cardDesign}
            logoIndex={layout.logoIndex}
            onSelect={() => onChannelSelect?.(channel)}
            onFocus={() => onChannelFocus?.(channel)}
          />
        ))}
      </EmblaHorizontalRail>
    </div>
  );
}

export default MostWatchedRail;
