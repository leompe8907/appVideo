/**
 * Contenido principal de Home: publicidad superior, Outlet de rutas, publicidad inferior.
 */

import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext';
import panaccessService from '../../services/panaccessService';
import { AdZone } from './AdZone';
import { usePreload } from '../../store/usePreload';
import InicioHeader from '../home/InicioHeader';
import { useBrand } from '../../contexts/BrandContext';
import { HomeHeaderProvider } from '../../contexts/HomeHeaderProvider';
import { useParentalGate } from '../../hooks/useParentalGate';
import { createAdActivateHandler } from '../../utils/adActivate';

export function HomeShellContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { play } = usePlayer();
  const { requestPlayChannel, requestPlayMedia } = useParentalGate();
  const { currentBrand } = useBrand();
  const { epg, ads, loadAds } = usePreload();

  const sectionKey = (() => {
    const p = location.pathname || '';
    if (p === '/home/inicio') return 'inicio';
    if (p === '/home/servicios-tv-radio') return 'serviciosTvRadio';
    if (p === '/home/vod') return 'vod';
    if (p === '/home/catchup') return 'catchup';
    return null;
  })();

  const headerEnabled =
    sectionKey &&
    (currentBrand?.homeShell?.header?.[sectionKey] ??
      // fallback seguro: si no está configurado, mantener el header activo en estas 4 secciones
      (sectionKey === 'inicio' || sectionKey === 'serviciosTvRadio' || sectionKey === 'vod' || sectionKey === 'catchup'));

  const adsEnabled =
    sectionKey &&
    Boolean(currentBrand?.homeShell?.ads?.[sectionKey] ?? (sectionKey === 'inicio'));

  const topInBouquets = Boolean(currentBrand?.homeShell?.ads?.topInBouquets ?? false);

  useEffect(() => {
    if (!adsEnabled) return;
    if (ads.status === 'idle') {
      loadAds();
    }
  }, [ads.status, loadAds, adsEnabled]);

  const handleActivate = useCallback(
    createAdActivateHandler({
      epgStreams: epg.streams,
      play,
      requestPlayChannel,
      requestPlayMedia,
      t,
      navigate,
      panaccessService,
    }),
    [epg.streams, navigate, panaccessService, play, requestPlayChannel, requestPlayMedia, t]
  );

  const { top, bottom } = ads;
  const hasTop = Array.isArray(top) && top.length > 0;
  const hasBottom = Array.isArray(bottom) && bottom.length > 0;

  return (
    <HomeHeaderProvider>
      <div className="home-content-stack">
        {headerEnabled && <InicioHeader sectionKey={sectionKey} />}
        {adsEnabled && hasTop && !(sectionKey === 'inicio' && topInBouquets === false) && (
          <AdZone
            key={`top-${top.map((a) => a.id).join('-')}`}
            zoneKey="top"
            ads={top}
            onActivate={handleActivate}
          />
        )}
        <div className="home-content-outlet">
          <Outlet />
        </div>
        {adsEnabled && hasBottom && (
          <AdZone
            key={`bottom-${bottom.map((a) => a.id).join('-')}`}
            zoneKey="bottom"
            ads={bottom}
            onActivate={handleActivate}
          />
        )}
      </div>
    </HomeHeaderProvider>
  );
}

export default HomeShellContent;
