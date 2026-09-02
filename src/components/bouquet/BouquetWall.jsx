import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  filterBouquetsForInicio,
  filterBouquetsForTvRadioServices,
  sortBouquetsByPriority,
} from '../../services/tvDataService';
import { useDevice } from '../../contexts/DeviceContext';
import { usePreload } from '../../store/usePreload';
import { resolveBouquetLayoutForDevice } from '../../utils/bouquetLayoutConfig';
import {
  BouquetHorizontalGrid,
  BouquetGridVertical,
} from './BouquetLayouts';
import { useMostWatchedBouquet } from '../../hooks/useMostWatchedBouquet';

/**
 * BouquetWall: filas de canales por bouquet (home 10foot).
 * Solo usa datos del preload (sin re-fetch ni spinner: la carga ocurre en /preload).
 *
 * @param {'inicio' | 'servicios'} variant - inicio: isMain !== false explícito; servicios: solo isMain=false.
 */
export function BouquetWall({ onChannelSelect, onChannelFocus, variant = 'inicio' }) {
  const { t } = useTranslation();
  const { isTV, isPC } = useDevice();
  const { epg } = usePreload();
  // Se llama siempre (regla de hooks), pero solo se mezcla al resultado en
  // variant "inicio" -- el hook mismo devuelve null si el brand no tiene
  // telemetry habilitado, así que en "servicios" es un no-op sin costo extra.
  const mostWatchedBouquet = useMostWatchedBouquet();

  const bouquets = useMemo(() => {
    if (epg.status !== 'ready') return [];
    const list = epg.bouquetsWithChannels || [];
    // Tras preload, bouquet.items ya comparten referencia con epg.streams y traen epgItems.
    const base = variant === 'servicios'
      ? filterBouquetsForTvRadioServices(list)
      : filterBouquetsForInicio(list);

    if (variant !== 'inicio' || !mostWatchedBouquet) return base;

    // "Más vistos" compite por posición según su `priority` real (viene del
    // mismo backend que los demás bouquets) en vez de quedar siempre fijo al
    // final -- re-ordena el conjunto completo con la misma función que ya
    // usan `filterBouquetsForInicio`/`filterBouquetsForTvRadioServices`.
    return sortBouquetsByPriority([...base, mostWatchedBouquet]);
  }, [epg.status, epg.bouquetsWithChannels, variant, mostWatchedBouquet]);

  if (epg.status === 'error') {
    return (
      <div className="bouquet-error">
        <p className="bouquet-error-text">{epg.error || t('bouquet.errorLoad')}</p>
      </div>
    );
  }

  if (!bouquets || bouquets.length === 0) {
    return (
      <div className="bouquet-empty">
        <p className="bouquet-empty-text">{t('bouquet.noBouquets')}</p>
      </div>
    );
  }

  return (
    <div className="bouquet-wall">
      {bouquets.map((bouquet) => {
        const layout = resolveBouquetLayoutForDevice(bouquet, { isTV, isPC });
        const key = bouquet.bouquetId ?? bouquet.id;
        const layoutProps = {
          bouquet,
          layoutType: layout.cardDesign,
          logoIndex: layout.logoIndex,
          gridRows: layout.gridRows,
          gridColumns: layout.gridColumns,
          containerType: layout.containerType,
          platformLayoutType: layout.platformLayoutType,
          onChannelSelect,
          onChannelFocus,
        };

        if (layout.containerType === 'vertical_grid') {
          return <BouquetGridVertical key={key} {...layoutProps} />;
        }

        return <BouquetHorizontalGrid key={key} {...layoutProps} />;
      })}
    </div>
  );
}

export default BouquetWall;
