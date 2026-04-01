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

export function PreloadDataPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBrand } = useBrand();
  const { epg, vod, catchup, ads, loadEPG, loadVOD, loadCatchup, loadAds } = usePreload();

  // Disparar cargas iniciales centralizadas
  useEffect(() => {
    if (!currentBrand) return;

    if (epg.status === 'idle') {
      loadEPG(currentBrand);
    }
    if (vod.status === 'idle') {
      loadVOD(currentBrand, { t });
    }
    if (currentBrand?.catchup?.enabled !== false && catchup.status === 'idle') {
      // Catchup no bloquea salida de preload; se carga en paralelo para decidir visibilidad en sidebar.
      loadCatchup(currentBrand);
    }
    if (ads.status === 'idle') {
      loadAds();
    }
  }, [
    currentBrand,
    epg.status,
    vod.status,
    catchup.status,
    ads.status,
    loadEPG,
    loadVOD,
    loadCatchup,
    loadAds,
    t,
  ]);

  // Cuando EPG y VOD estén listos (o en error), redirigir a Home/Bouquets
  useEffect(() => {
    const epgReady = epg.status === 'ready' || epg.status === 'error';
    const vodReady = vod.status === 'ready' || vod.status === 'error';

    if (epgReady && vodReady) {
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      const safeTarget =
        redirect && redirect.startsWith('/home/')
          ? redirect
          : '/home/inicio';
      navigate(safeTarget, { replace: true });
    }
  }, [epg.status, vod.status, navigate, location.search]);

  return <PreloadScreen />;
}

export default PreloadDataPage;

