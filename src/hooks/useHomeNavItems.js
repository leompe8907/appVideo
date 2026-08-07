import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';
import { useOsmsStore } from '../store/osmsStore';
import { hasTvRadioServiceBouquets } from '../services/tvDataService';
import { getSubscriberName } from '../utils/userSession';
import { useActiveProfile } from '../store/useActiveProfile';
import { getProfileAvatars } from '../constants/images';

/**
 * Datos de navegación de Home compartidos entre el Sidebar (rail vertical) y
 * el Topbar (barra horizontal): qué mostrar en el ícono/label de "Mi cuenta"
 * (avatar de perfil vs. nombre de suscriptor + badge de OSMS) y qué links de
 * navegación están habilitados según brand/estado (VOD vacío, catchup
 * deshabilitado, bouquets de TV/Radio disponibles, etc).
 *
 * Única fuente de verdad para estas reglas: evita que Sidebar y Topbar
 * diverjan silenciosamente en qué se muestra.
 */
export function useHomeNavItems() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { vod, catchup, epg } = usePreload();
  const subscriberName = getSubscriberName();
  const activeProfile = useActiveProfile();

  const profilesFeatureEnabled = currentBrand?.features?.profiles === true;
  const activeProfileAvatarUrl =
    profilesFeatureEnabled && activeProfile.id != null
      ? getProfileAvatars(currentBrand?.brand).find((img) => img.id === activeProfile.imageId)?.img || null
      : null;
  const accountDisplayName =
    (profilesFeatureEnabled && activeProfile.name) || subscriberName || t('sidebar.account', { defaultValue: 'Cuenta' });

  const vodIsEmptyAfterLoad =
    vod.status === 'ready' &&
    (vod.allVods?.length ?? 0) === 0 &&
    (vod.categories?.length ?? 0) === 0 &&
    (vod.vodRecommended?.length ?? 0) === 0;

  const catchupIsEmptyAfterLoad =
    catchup.status === 'ready' &&
    (catchup.groups?.length ?? 0) === 0 &&
    (catchup.recorded?.length ?? 0) === 0;

  const showVod = !vodIsEmptyAfterLoad;
  const catchupEnabledByBrand = currentBrand?.catchup?.enabled !== false;
  const showCatchup = catchupEnabledByBrand && !catchupIsEmptyAfterLoad;

  const showTvRadioServices =
    epg.status === 'ready' && hasTvRadioServiceBouquets(epg.bouquetsWithChannels || []);

  const osmsUnreadCount = useOsmsStore((s) => s.unreadCount);
  const osmsBadgeVisible = currentBrand?.features?.osms === true && osmsUnreadCount > 0;

  const itemsMap = {
    search: { key: 'search', to: '/home/buscador', label: t('sidebar.search', { defaultValue: 'Buscar' }), icon: 'search' },
    inicio: { key: 'inicio', to: '/home/inicio', label: t('sidebar.bouquets', { defaultValue: 'Inicio' }), icon: 'home' },
    channels: showTvRadioServices
      ? {
          key: 'channels',
          to: '/home/servicios-tv-radio',
          label: t('sidebar.tvRadioServices', { defaultValue: 'Canales' }),
          icon: 'channels',
        }
      : null,
    vod: showVod
      ? {
          key: 'vod',
          to: '/home/vod',
          label: t('sidebar.movies', { defaultValue: 'Películas' }),
          icon: 'movies',
        }
      : null,
    epg: { key: 'epg', to: '/home/epg', label: t('sidebar.channelGuide', { defaultValue: 'Guía' }), icon: 'guide' },
    catchup: showCatchup
      ? {
          key: 'catchup',
          to: '/home/catchup',
          label: t('sidebar.catchup'),
          icon: 'catchup',
        }
      : null,
  };

  const defaultOrder = ['search', 'inicio', 'channels', 'vod', 'epg', 'catchup'];
  const preferredOrder = currentBrand?.layout?.navOrder || defaultOrder;

  const navItems = preferredOrder
    .map((key) => itemsMap[key])
    .filter(Boolean);

  return {
    accountDisplayName,
    activeProfileAvatarUrl,
    osmsUnreadCount,
    osmsBadgeVisible,
    navItems,
  };
}

export default useHomeNavItems;
