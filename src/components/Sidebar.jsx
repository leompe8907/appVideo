import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';

function SidebarLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `home-sidebar-link${isActive ? ' active' : ''}`}
    >
      {label}
    </NavLink>
  );
}

/**
 * Sidebar izquierda del módulo Home.
 * Mantiene diseño + labels traducidos y navegación por rutas hijas (/home/...).
 */
export function Sidebar() {
  const { t } = useTranslation();
  const { appName, currentBrand } = useBrand();
  const { vod, catchup } = usePreload();

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

  return (
    <aside className="home-sidebar" aria-label={t('common.menu', { defaultValue: 'Menu' })}>
      <div className="home-sidebar-header">{appName || 'App'}</div>
      <nav className="home-sidebar-nav">
        <SidebarLink to="/home/bouquets" label="Canales" />
        {showVod && <SidebarLink to="/home/vod" label="Peliculas" />}
        <SidebarLink to="/home/epg" label={t('epg.title', { defaultValue: 'Channel guide' })} />
        <SidebarLink to="/home/inicio" label="Inicio" />
        {showCatchup && (
          <SidebarLink to="/home/catchup" label={t('common.catchup', { defaultValue: 'Catchup' })} />
        )}
        {currentBrand?.features?.osms && (
          <SidebarLink to="/home/osms" label={t('common.osms', { defaultValue: 'OSMS' })} />
        )}
      </nav>
    </aside>
  );
}

export default Sidebar;

