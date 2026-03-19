import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import '../styles/pages/_home-shell.scss';

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

export function HomePlaceholderPage({ title, description }) {
  return (
    <section className="home-placeholder" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { appName } = useBrand();

  if (pathname === '/home') {
    return <Navigate to="/home/bouquets" replace />;
  }

  return (
    <div className="home-shell">
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
      <main className="home-content">
        <Outlet />
      </main>
    </div>
  );
}

export default HomePage;

