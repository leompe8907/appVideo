/**
 * Riel "Más vistos" en Inicio -- ranking global de canales OTT que calcula
 * el backend Wind (ver `telemetry` app en Back-Wind-V2 y
 * `services/telemetryService.js` en este repo).
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
import { usePreload } from '../../store/usePreload';
import { getBouquetHorizontalGridClasses } from '../../utils/bouquetLayoutClasses';
import { EmblaHorizontalRail } from '../navigation/EmblaHorizontalRail';
import { ChannelCard } from './BouquetLayouts';
import {
  buildMostWatchedItems,
  getTopChannelsGlobal,
  isTelemetryEnabled,
} from '../../services/telemetryService';

export function MostWatchedRail({ onChannelSelect, onChannelFocus }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { epg } = usePreload();
  const [items, setItems] = useState([]);
  const requestedRef = useRef(false);

  const brand = currentBrand?.brand;
  const enabled = isTelemetryEnabled(currentBrand);

  useEffect(() => {
    // Reintentar si cambia de brand (p. ej. host multi-marca).
    requestedRef.current = false;
    setItems([]);
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
      if (!cancelled && matched.length > 0) setItems(matched);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, epg.status, epg.streams, currentBrand, brand]);

  if (!enabled || items.length === 0) return null;

  const { root: rootClass, track: trackClass } = getBouquetHorizontalGridClasses(null);

  return (
    <div className={rootClass} data-bouquet-id="most-watched">
      <h4 className="bouquet-heading">
        {t('bouquet.mostWatched', { defaultValue: 'Más vistos' })}
      </h4>
      <EmblaHorizontalRail className={trackClass}>
        {items.map((channel, index) => (
          <ChannelCard
            key={channel.id ?? `${index}-${channel.lcn ?? ''}`}
            channel={channel}
            onSelect={() => onChannelSelect?.(channel)}
            onFocus={() => onChannelFocus?.(channel)}
          />
        ))}
      </EmblaHorizontalRail>
    </div>
  );
}

export default MostWatchedRail;
