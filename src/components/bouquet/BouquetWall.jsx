import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  filterBouquetsForInicio,
  filterBouquetsForTvRadioServices,
} from '../../services/tvDataService';
import { useDevice } from '../../contexts/DeviceContext';
import { usePreload } from '../../store/usePreload';
import { resolveBouquetLayoutForDevice } from '../../utils/bouquetLayoutConfig';
import {
  BouquetHorizontalGrid,
  BouquetGridVertical,
} from './BouquetLayouts';
import MostWatchedRail from './MostWatchedRail';

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

  const bouquets = useMemo(() => {
    if (epg.status !== 'ready') return [];
    const list = epg.bouquetsWithChannels || [];
    if (list.length === 0) return [];
    // Tras preload, bouquet.items ya comparten referencia con epg.streams y traen epgItems.
    return variant === 'servicios'
      ? filterBouquetsForTvRadioServices(list)
      : filterBouquetsForInicio(list);
  }, [epg.status, epg.bouquetsWithChannels, variant]);

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
      {/* Se renderiza como último ítem del wall (no como hermano suelto en
          BouquetPage.jsx) para heredar el mismo `margin-block-end` /
          `:last-child` que aplica `bouquet-stack-spacing` a los bouquets de
          arriba -- si termina siendo el último elemento real, queda sin
          margen inferior igual que cualquier bouquet; si no, con el margen
          estándar de 2rem. Solo aplica al variant "inicio" (donde vivía
          antes); MostWatchedRail se auto-oculta (retorna null) si el brand
          no tiene telemetry habilitado o no hay ranking, así que no agrega
          nada al DOM en variant "servicios" ni cuando no hay datos. */}
      {variant === 'inicio' && (
        <MostWatchedRail onChannelSelect={onChannelSelect} onChannelFocus={onChannelFocus} />
      )}
    </div>
  );
}

export default BouquetWall;
