import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { usePreload } from '../../store/usePreload';
import { PreloadScreen } from './PreloadScreen';

/**
 * Loader en línea (dentro de Home) que dispara descargas centralizadas
 * pero NO navega a otra ruta, para que el sidebar permanezca visible.
 */
export function PreloadLoader() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { epg, vod, loadEPG, loadVOD } = usePreload();

  useEffect(() => {
    if (!currentBrand) return;

    if (epg.status === 'idle') {
      loadEPG(currentBrand);
    }

    if (vod.status === 'idle') {
      loadVOD(currentBrand, { t });
    }
  }, [currentBrand, epg.status, vod.status, loadEPG, loadVOD, t]);

  return <PreloadScreen />;
}

export default PreloadLoader;

