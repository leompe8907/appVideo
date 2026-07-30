import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { useHomeNavItems } from '../hooks/useHomeNavItems';
import { HomeNavIcon as SidebarIcon } from './HomeNavIcon';
import { TV_ACTION } from '../utils/tvRemote';
import { navigationRouter } from '../navigation/NavigationRouter';
import { focusFirstIn, moveFocus, scrollIntoViewWithinAncestors } from '../navigation/spatialNavigation';
import { requestTvFocusRingSync } from './navigation/TvFocusRing';

function SidebarLabel({ text, expanded }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!expanded) {
      el.style.fontSize = '';
      return;
    }

    const adjust = () => {
      const parent = el.parentElement;
      if (!parent) return;

      el.style.fontSize = '';

      const parentWidth = parent.getBoundingClientRect().width;
      if (parentWidth === 0) return;

      // offsetLeft nos da el espacio ocupado por el riel de iconos (columna 1 del grid/flex)
      const offsetLeft = el.offsetLeft || 0;

      const padding = 20; // Margen de seguridad para no tocar los bordes
      const availableWidth = parentWidth - offsetLeft - padding;

      if (availableWidth <= 0) return;

      const textWidth = el.scrollWidth;
      const currentFontSize = parseFloat(window.getComputedStyle(el).fontSize);

      if (textWidth > availableWidth && currentFontSize > 11) {
        const ratio = availableWidth / textWidth;
        const targetSize = Math.max(11, currentFontSize * ratio);
        el.style.fontSize = `${targetSize}px`;
      }
    };

    adjust();
    const timer = setTimeout(adjust, 250);

    return () => clearTimeout(timer);
  }, [text, expanded]);

  return (
    <span ref={ref} className="home-sidebar-label">
      {text}
    </span>
  );
}

function SidebarLink({ to, label, icon, onSelect, currentPathname, navigate, expanded }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `home-sidebar-link${isActive ? ' active' : ''}`}
      onClick={(e) => {
        // Si ya estamos en la misma ruta, "forzar" navegación para que la app pueda reaccionar
        // (ej: cerrar overlays/modales montados por estado local).
        if (currentPathname === to) {
          e.preventDefault();
          navigate?.(to, { replace: true, state: { _navNonce: Date.now() } });
        }
        onSelect?.();
      }}
    >
      {icon ? <SidebarIcon name={icon} /> : null}
      <SidebarLabel text={label} expanded={expanded} />
    </NavLink>
  );
}

/**
 * Sidebar izquierda del módulo Home.
 * Mantiene diseño + labels traducidos y navegación por rutas hijas (/home/...).
 */
export function Sidebar({ expanded = false, onExpandedChange }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const { currentBrand } = useBrand();
  const { accountDisplayName, activeProfileAvatarUrl, osmsUnreadCount, osmsBadgeVisible, navItems } = useHomeNavItems();
  const blurTimerRef = useRef(null);
  const tvMainFocusCancelRef = useRef(null);
  const pendingTvNavFocusRef = useRef(false);
  const sidebarFixed = currentBrand?.ui?.sidebar?.fixed !== false;

  const setExpandedSafe = (next) => {
    if (typeof onExpandedChange === 'function') {
      onExpandedChange(Boolean(next));
    }
  };

  const collapseSidebar = () => setExpandedSafe(false);

  /** Tras elegir sección: en PC solo colapsa; en TV marca foco pendiente tras cambiar ruta. */
  const collapseAfterNav = () => {
    collapseSidebar();
    if (isTV) pendingTvNavFocusRef.current = true;
  };

  const runPendingTvMainFocus = () => {
    if (tvMainFocusCancelRef.current) {
      tvMainFocusCancelRef.current();
      tvMainFocusCancelRef.current = null;
    }
    // Primer foco visible del contenido principal: el motor genérico de
    // navegación espacial ya no necesita saber qué ruta es (VOD/Inicio/etc);
    // basta con el primer elemento enfocable dentro del <main>.
    tvMainFocusCancelRef.current = focusFirstIn(
      'main.home-content[data-home-scope="content"]',
      { maxAttempts: 48 }
    );
  };

  const scheduleCollapseIfOutside = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      const root = rootRef.current;
      const active = document.activeElement;
      if (!root || !active) {
        setExpandedSafe(false);
        return;
      }
      if (!root.contains(active)) {
        setExpandedSafe(false);
      }
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
      if (tvMainFocusCancelRef.current) {
        tvMainFocusCancelRef.current();
        tvMainFocusCancelRef.current = null;
      }
    };
  }, []);

  // Si la ruta cambia (navegación desde cualquier origen), colapsar el sidebar.
  useEffect(() => {
    collapseSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // TV: tras elegir sección en sidebar, enfocar primer ítem de la ruta nueva (post-navegación).
  useEffect(() => {
    if (!isTV || !pendingTvNavFocusRef.current) return undefined;
    pendingTvNavFocusRef.current = false;
    runPendingTvMainFocus();
    return () => {
      if (tvMainFocusCancelRef.current) {
        tvMainFocusCancelRef.current();
        tvMainFocusCancelRef.current = null;
      }
    };
    // location.key: misma ruta con replace (p. ej. re-entrar a Inicio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.key, isTV]);

  // Al expandir el rail (overlay), reposicionar scroll + anillo sobre el ítem activo.
  useLayoutEffect(() => {
    if (!expanded) return undefined;
    const root = rootRef.current;
    const active = document.activeElement;
    if (!(root instanceof HTMLElement)) return undefined;
    if (!(active instanceof HTMLElement) || !root.contains(active)) return undefined;
    scrollIntoViewWithinAncestors(active, root);
    requestTvFocusRingSync();
    return undefined;
  }, [expanded]);

  // TV: única excepción NO puramente espacial del sidebar. Todo lo demás —
  // UP/DOWN entre links, RIGHT hacia el contenido, LEFT desde el contenido —
  // lo resuelve el motor genérico de navegación espacial (`NavigationRouter`)
  // por geometría, sin necesidad de un handler ni de un modelo de índices por pantalla.
  useEffect(() => {
    if (!isTV) return undefined;
    const unregister = navigationRouter.register('global', (action) => {
      const root = rootRef.current;
      if (!(root instanceof HTMLElement)) return false;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !root.contains(active)) return false;

      // UP/DOWN nunca deben "escapar" del sidebar hacia el contenido principal:
      // si se delega al motor genérico con scope=document (sin zona activa), y
      // no hay más elementos en esa dirección dentro del sidebar (ej. parado en
      // "Cuenta", el primer ítem), el candidato más cercano en todo el documento
      // puede terminar siendo una tarjeta del muro de bouquets. Al escopar
      // explícitamente al propio `root`, o se mueve dentro del sidebar o no pasa
      // nada — nunca se filtra hacia afuera. RIGHT sigue saliendo al contenido.
      if (action === TV_ACTION.UP || action === TV_ACTION.DOWN) {
        moveFocus(action, root);
        return true;
      }

      return false;
    });
    return unregister;
  }, [isTV]);

  return (
    <aside
      ref={rootRef}
      data-home-scope="sidebar"
      className={[
        'home-sidebar',
        expanded ? '' : 'home-sidebar--collapsed',
        expanded ? 'home-sidebar--overlay' : '',
        sidebarFixed ? 'home-sidebar--fixed' : '',
      ].filter(Boolean).join(' ')}
      aria-label={t('sidebar.menu')}
      onFocusCapture={() => setExpandedSafe(true)}
      onBlurCapture={scheduleCollapseIfOutside}
      onMouseEnter={() => setExpandedSafe(true)}
      onMouseLeave={() => scheduleCollapseIfOutside()}
    >
      <div className="home-sidebar-body">
        <div className="home-sidebar-group home-sidebar-group--account">
          <NavLink
            to="/home/mi-cuenta"
            className={({ isActive }) => `home-sidebar-link home-sidebar-settings-btn${isActive ? ' active' : ''}`}
            aria-label={accountDisplayName}
            onClick={(e) => {
              if (location.pathname === '/home/mi-cuenta') {
                e.preventDefault();
                navigate('/home/mi-cuenta', { replace: true, state: { _navNonce: Date.now() } });
              }
              collapseAfterNav();
            }}
          >
            {activeProfileAvatarUrl ? (
              <img
                src={activeProfileAvatarUrl}
                alt=""
                className="home-sidebar-icon home-sidebar-account-avatar"
              />
            ) : (
              <SidebarIcon name="account" />
            )}
            <SidebarLabel
              text={accountDisplayName}
              expanded={expanded}
            />
            {osmsBadgeVisible ? (
              <span
                className="home-sidebar-badge home-sidebar-badge--settings"
                aria-label={t('osms.unreadBadge', {
                  count: osmsUnreadCount,
                  defaultValue: `${osmsUnreadCount} sin leer`,
                })}
              >
                {osmsUnreadCount}
              </span>
            ) : null}
          </NavLink>
        </div>

        <nav className="home-sidebar-group home-sidebar-group--nav" aria-label={t('sidebar.mainNav', { defaultValue: 'Navegación principal' })}>
          {navItems.map((item) => (
            <SidebarLink
              key={item.key}
              to={item.to}
              label={item.label}
              icon={item.icon}
              onSelect={collapseAfterNav}
              currentPathname={location.pathname}
              navigate={navigate}
              expanded={expanded}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;

