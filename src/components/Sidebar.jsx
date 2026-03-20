import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';

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
  const { appName } = useBrand();

  return (
    <aside className="home-sidebar" aria-label={t('common.menu', { defaultValue: 'Menu' })}>
      <div className="home-sidebar-header">{appName || 'App'}</div>
      <nav className="home-sidebar-nav">
        <SidebarLink to="/home/bouquets" label={t('bouquet.title', { defaultValue: 'Bouquets' })} />
        <SidebarLink to="/home/vod" label={t('vod.title', { defaultValue: 'VOD' })} />
        <SidebarLink to="/home/ads" label={t('common.ads', { defaultValue: 'Ads' })} />
        <SidebarLink to="/home/catchup" label={t('common.catchup', { defaultValue: 'Catchup' })} />
        <SidebarLink to="/home/osms" label={t('common.osms', { defaultValue: 'OSMS' })} />
      </nav>
    </aside>
  );
}

export default Sidebar;

