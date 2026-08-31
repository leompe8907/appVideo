/**
 * Riel "Más vistos" en Inicio -- ranking global de canales OTT que calcula
 * el backend Wind (ver `telemetry` app en Back-Wind-V2 y
 * `services/mostWatchedChannelsService.js` en este repo).
 *
 * No inyecta entradas sintéticas en `epg.bouquetsWithChannels` -- solo cruza
 * el ranking contra `epg.streams` ya cargado por el preload (mismo patrón
 * que `VodRecommendedHomeRail`) y arma un objeto bouquet sintético en
 * memoria para reusar `BouquetHorizontalGrid` (`BouquetLayouts.jsx`) TAL
 * CUAL, en vez de reimplementar el render con `EmblaHorizontalRail` +
 * `ChannelCard` sueltos como antes. Esa reimplementación manual dejaba las
 * tarjetas sin ancho definido (por pasarle a Embla una clase de contenedor
 * que no correspondía) y como consecuencia los botones de flecha quedaban
 * siempre deshabilitados -- reusar el mismo componente que usa el resto del
 * muro garantiza paridad total (ancho de tarjeta, flechas, y también
 * comportamiento en TV con lista virtualizada) sin duplicar esa lógica.
 *
 * Se renderiza como el último ítem de `.bouquet-wall` (ver `BouquetWall.jsx`,
 * variant "inicio") para heredar el mismo espaciado entre bouquets
 * (`bouquet-stack-spacing`) en vez de quedar como hermano suelto con un
 * padding distinto.
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
import { resolveBouquetLayoutForDevice } from '../../utils/bouquetLayoutConfig';
import { BouquetHorizontalGrid } from './BouquetLayouts';
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

  const bouquet = {
    bouquetId: 'most-watched',
    name: t('bouquet.mostWatched', { defaultValue: 'Más vistos' }),
    items,
    customData,
  };
  const layout = resolveBouquetLayoutForDevice(bouquet, { isTV, isPC });

  return (
    <BouquetHorizontalGrid
      bouquet={bouquet}
      layoutType={layout.cardDesign}
      logoIndex={layout.logoIndex}
      gridRows={layout.gridRows}
      containerType={layout.containerType}
      platformLayoutType={layout.platformLayoutType}
      onChannelSelect={onChannelSelect}
      onChannelFocus={onChannelFocus}
    />
  );
}

export default MostWatchedRail;
