/**
 * Página dedicada a centralizar la descarga inicial de datos:
 * - EPG + streams/servicios (a través de loadEPG, que internamente usa tvDataService)
 * - VOD (categorías, contenido, recomendados)
 * - Bouquets asociados a los streams (a través de loadEPG/getBouquetsWithChannels)
 *
 * Muestra la misma UI de carga que PreloadScreen y, cuando termina,
 * redirige automáticamente a la página principal de bouquets.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../contexts/PreloadContext';
import { PreloadScreen } from '../components/preload/PreloadScreen';

export function PreloadDataPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand } = useBrand();
  const { epg, vod, loadEPG, loadVOD } = usePreload();

  // Disparar cargas iniciales centralizadas
  useEffect(() => {
    if (!currentBrand) return;

    if (epg.status === 'idle') {
      loadEPG(currentBrand);
    }

    if (vod.status === 'idle') {
      loadVOD(currentBrand, { t });
    }
  }, [currentBrand, epg.status, vod.status, loadEPG, loadVOD, t]);

  // Cuando EPG y VOD estén listos (o en error), redirigir a bouquets
  useEffect(() => {
    const epgReady = epg.status === 'ready' || epg.status === 'error';
    const vodReady = vod.status === 'ready' || vod.status === 'error';

    if (epgReady && vodReady) {
      navigate('/bouquets', { replace: true });
    }
  }, [epg.status, vod.status, navigate]);

  return <PreloadScreen />;
}

export default PreloadDataPage;

