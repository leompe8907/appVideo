/**
 * Página dedicada a centralizar la descarga inicial de datos:
 * - EPG + streams/servicios (a través de loadEPG, que internamente usa tvDataService)
 * - VOD (categorías, contenido, recomendados)
 * - Bouquets asociados a los streams (a través de loadEPG/getBouquetsWithChannels)
 * - Publicidad (getAds), en paralelo; no bloquea la redirección al terminar EPG+VOD
 *
 * Muestra la misma UI de carga que PreloadScreen y, cuando termina,
 * redirige automáticamente a Home/Bouquets.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';
import { PreloadScreen } from '../components/preload/PreloadScreen';
import { useAdsQuery } from '../query/hooks/useAdsQuery';
import { useVodQuery } from '../query/hooks/useVodQuery';

export function PreloadDataPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBrand } = useBrand();
  const { epg, loadEPG } = usePreload();
  const vodQuery = useVodQuery(currentBrand, { enabled: !!currentBrand, t });
  useAdsQuery({ enabled: true });

  // Disparar cargas iniciales centralizadas
  useEffect(() => {
    if (!currentBrand) return;

    if (epg.status === 'idle') {
      loadEPG(currentBrand);
    }
  }, [currentBrand, epg.status, loadEPG]);

  // Cuando EPG y VOD estén listos (o en error), redirigir a Home/Bouquets
  useEffect(() => {
    const epgReady = epg.status === 'ready' || epg.status === 'error';
    const vodReady = vodQuery.isSuccess || vodQuery.isError;

    if (epgReady && vodReady) {
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      const safeTarget =
        redirect && redirect.startsWith('/home/')
          ? redirect
          : '/home/bouquets';
      navigate(safeTarget, { replace: true });
    }
  }, [epg.status, vodQuery.isSuccess, vodQuery.isError, navigate, location.search]);

  return <PreloadScreen />;
}

export default PreloadDataPage;

