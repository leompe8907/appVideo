import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { useHomeNavItems } from '../hooks/useHomeNavItems';
import { HomeNavIcon } from './HomeNavIcon';
import { resolveTopbarAreas } from '../config/brandConfig';
import { TV_ACTION } from '../utils/tvRemote';
import { navigationRouter } from '../navigation/NavigationRouter';
import { moveFocus } from '../navigation/spatialNavigation';

function TopbarLink({ to, label, icon, currentPathname, navigate }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `home-topbar-link${isActive ? ' active' : ''}`}
      onClick={(e) => {
        // Igual que en Sidebar: si ya estamos en la misma ruta, forzar navegación
        // para que la app pueda reaccionar (ej. cerrar overlays/modales locales).
        if (currentPathname === to) {
          e.preventDefault();
          navigate?.(to, { replace: true, state: { _navNonce: Date.now() } });
        }
      }}
    >
      {icon ? <HomeNavIcon name={icon} className="home-topbar-icon" /> : null}
      <span className="home-topbar-label">{label}</span>
    </NavLink>
  );
}

function TopbarLogo({ currentBrand }) {
  const src = currentBrand?.assets?.logoTop || currentBrand?.assets?.logo;
  if (!src) return null;
  return (
    <div className="home-topbar-zone-logo">
      <img src={src} alt={currentBrand?.appName || ''} className="home-topbar-logo-img" />
    </div>
  );
}

function TopbarNav({ navItems, location, navigate }) {
  return (
    <nav className="home-topbar-nav" aria-label="Navegación principal">
      {navItems.map((item) => (
        <TopbarLink
          key={item.key}
          to={item.to}
          label={item.label}
          icon={item.icon}
          currentPathname={location.pathname}
          navigate={navigate}
        />
      ))}
    </nav>
  );
}

function TopbarAccount({ accountDisplayName, activeProfileAvatarUrl, osmsBadgeVisible, osmsUnreadCount, location, navigate, t }) {
  return (
    <NavLink
      to="/home/mi-cuenta"
      className={({ isActive }) => `home-topbar-link home-topbar-account${isActive ? ' active' : ''}`}
      aria-label={accountDisplayName}
      onClick={(e) => {
        if (location.pathname === '/home/mi-cuenta') {
          e.preventDefault();
          navigate('/home/mi-cuenta', { replace: true, state: { _navNonce: Date.now() } });
        }
      }}
    >
      {activeProfileAvatarUrl ? (
        <img src={activeProfileAvatarUrl} alt="" className="home-topbar-icon home-topbar-account-avatar" />
      ) : (
        <HomeNavIcon name="account" className="home-topbar-icon" />
      )}
      <span className="home-topbar-label">{accountDisplayName}</span>
      {osmsBadgeVisible ? (
        <span
          className="home-topbar-badge"
          aria-label={t('osms.unreadBadge', { count: osmsUnreadCount, defaultValue: `${osmsUnreadCount} sin leer` })}
        >
          {osmsUnreadCount}
        </span>
      ) : null}
    </NavLink>
  );
}

/**
 * Topbar horizontal del módulo Home: alternativa al Sidebar vertical,
 * activable de forma independiente por marca/plataforma vía
 * `brand.layout.shell.{pc,tv}`. Distribuye logo/nav/cuenta en 3 zonas
 * (left/center/right) según `brand.layout.topbar.areas`.
 *
 * A diferencia del Sidebar no colapsa/expande: siempre está visible con
 * labels a la vista (Alternativa A — comportamiento estático simple).
 */
export function Topbar() {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const { currentBrand } = useBrand();
  const { accountDisplayName, activeProfileAvatarUrl, osmsUnreadCount, osmsBadgeVisible, navItems } = useHomeNavItems();

  const areas = resolveTopbarAreas(currentBrand);

  const renderZone = (content) => {
    switch (content) {
      case 'logo':
        return <TopbarLogo currentBrand={currentBrand} />;
      case 'nav':
        return <TopbarNav navItems={navItems} location={location} navigate={navigate} />;
      case 'account':
        return (
          <TopbarAccount
            accountDisplayName={accountDisplayName}
            activeProfileAvatarUrl={activeProfileAvatarUrl}
            osmsBadgeVisible={osmsBadgeVisible}
            osmsUnreadCount={osmsUnreadCount}
            location={location}
            navigate={navigate}
            t={t}
          />
        );
      default:
        return null;
    }
  };

  // TV (por si alguna marca activa topbar también en TV): igual que el Sidebar,
  // confinar el eje propio (LEFT/RIGHT) dentro del topbar para que nunca "se
  // fugue" hacia el contenido; DOWN sigue delegado al motor genérico.
  useEffect(() => {
    if (!isTV) return undefined;
    const unregister = navigationRouter.register('global', (action) => {
      const root = rootRef.current;
      if (!(root instanceof HTMLElement)) return false;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !root.contains(active)) return false;

      if (action === TV_ACTION.LEFT || action === TV_ACTION.RIGHT) {
        moveFocus(action, root);
        return true;
      }

      return false;
    });
    return unregister;
  }, [isTV]);

  return (
    <header ref={rootRef} data-home-scope="topbar" className="home-topbar" aria-label={t('sidebar.menu')}>
      <div className="home-topbar-zone home-topbar-zone--left">{renderZone(areas.left)}</div>
      <div className="home-topbar-zone home-topbar-zone--center">{renderZone(areas.center)}</div>
      <div className="home-topbar-zone home-topbar-zone--right">{renderZone(areas.right)}</div>
    </header>
  );
}

export default Topbar;
