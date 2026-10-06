import {useEffect} from 'react';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {hasTvRadioServiceBouquets} from '@appvideo/core/services/tvDataService';
import {getSubscriberName} from '@appvideo/core/utils/userSession';

const t = (key, opts) => i18n.t(key, opts);

const DEFAULT_ORDER = ['search', 'inicio', 'channels', 'vod', 'epg', 'catchup'];

/**
 * Ítems del menú lateral con las mismas reglas que useHomeNavItems de la web
 * (spec §1.5): orden de `layout.navOrder`, Canales sólo con bouquets no-main,
 * Películas/Catchup ocultos si cargaron vacíos, Guía según `EPG.enabled`.
 * Cuenta va siempre primero, aparte.
 */
export function useHomeNavItems() {
  const brand = getActiveBrandConfig();
  const epg = usePreloadStore((s) => s.epg);
  const vod = usePreloadStore((s) => s.vod);
  const catchup = usePreloadStore((s) => s.catchup);
  const loadVOD = usePreloadStore((s) => s.loadVOD);
  const loadCatchup = usePreloadStore((s) => s.loadCatchup);

  const catchupEnabled = brand?.catchup?.enabled !== false;
  const epgEnabled = brand?.EPG?.enabled !== false;

  // Como en la web: sin cargar VOD/Catchup no se sabe si ocultar sus ítems.
  useEffect(() => {
    if (!brand) return;
    if (vod.status === 'idle') loadVOD(brand, {t});
    if (catchupEnabled && catchup.status === 'idle') loadCatchup(brand);
  }, [brand, vod.status, catchup.status, catchupEnabled, loadVOD, loadCatchup]);

  const vodEmpty =
    vod.status === 'ready' &&
    (vod.allVods?.length ?? 0) === 0 &&
    (vod.categories?.length ?? 0) === 0 &&
    (vod.vodRecommended?.length ?? 0) === 0;
  const catchupEmpty =
    catchup.status === 'ready' && (catchup.groups?.length ?? 0) === 0 && (catchup.recorded?.length ?? 0) === 0;

  const items = {
    search: {key: 'search', label: t('sidebar.search'), icon: 'search'},
    inicio: {key: 'inicio', label: t('sidebar.bouquets'), icon: 'home'},
    channels:
      epg.status === 'ready' && hasTvRadioServiceBouquets(epg.bouquetsWithChannels || [])
        ? {key: 'channels', label: t('sidebar.tvRadioServices'), icon: 'channels'}
        : null,
    vod: !vodEmpty ? {key: 'vod', label: t('sidebar.movies'), icon: 'movies'} : null,
    epg: epgEnabled ? {key: 'epg', label: t('sidebar.channelGuide'), icon: 'guide'} : null,
    catchup: catchupEnabled && !catchupEmpty ? {key: 'catchup', label: t('sidebar.catchup'), icon: 'catchup'} : null,
  };

  const order = brand?.layout?.navOrder || DEFAULT_ORDER;
  return {
    account: {key: 'account', label: getSubscriberName() || t('sidebar.account'), icon: 'account'},
    navItems: order.map((k) => items[k]).filter(Boolean),
  };
}
