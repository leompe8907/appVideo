import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';
import panaccessService from '../services/panaccessService';
import { hasTvRadioServiceBouquets } from '../services/tvDataService';
import { setLoggedOut, getActiveLicense, getCredentials } from '../utils/userSession';
import MessageModal from './MessageModal';
import ConfirmModal from './ConfirmModal';

function SidebarIcon({ name }) {
  const common = {
    className: 'home-sidebar-icon',
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    focusable: false,
  };

  switch (name) {
    case 'channels':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'movies':
      return (
        <svg {...common}>
          <path
            d="M4 7h16v10H4V7Zm3-2v4m4-4v4m4-4v4m4-4v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'guide':
      return (
        <svg {...common}>
          <path
            d="M6 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M8 8h8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M19.4 15a7.9 7.9 0 0 0 .06-1 7.9 7.9 0 0 0-.06-1l2.02-1.58a.6.6 0 0 0 .14-.77l-1.9-3.3a.6.6 0 0 0-.73-.26l-2.38.96a7.7 7.7 0 0 0-1.73-1l-.36-2.54A.6.6 0 0 0 14.9 2h-3.8a.6.6 0 0 0-.6.5l-.36 2.54a7.7 7.7 0 0 0-1.73 1l-2.38-.96a.6.6 0 0 0-.73.26l-1.9 3.3a.6.6 0 0 0 .14.77L4.6 13a7.9 7.9 0 0 0-.06 1 7.9 7.9 0 0 0 .06 1L2.58 16.58a.6.6 0 0 0-.14.77l1.9 3.3a.6.6 0 0 0 .73.26l2.38-.96c.54.42 1.12.76 1.73 1l.36 2.54a.6.6 0 0 0 .6.5h3.8a.6.6 0 0 0 .6-.5l.36-2.54c.61-.24 1.19-.58 1.73-1l2.38.96a.6.6 0 0 0 .73-.26l1.9-3.3a.6.6 0 0 0-.14-.77L19.4 15Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function SidebarLink({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `home-sidebar-link${isActive ? ' active' : ''}`}
    >
      {icon ? <SidebarIcon name={icon} /> : null}
      <span className="home-sidebar-label">{label}</span>
    </NavLink>
  );
}

/**
 * Sidebar izquierda del módulo Home.
 * Mantiene diseño + labels traducidos y navegación por rutas hijas (/home/...).
 */
export function Sidebar({ expanded = false, onExpandedChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const { appName, currentBrand } = useBrand();
  const { vod, catchup, epg } = usePreload();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'logout' | 'exit' | null
  const blurTimerRef = useRef(null);
  const sidebarFixed = currentBrand?.ui?.sidebar?.fixed !== false;

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

  const aboutMessage = useMemo(() => {
    const cred = getCredentials();
    const username = cred?.username ? String(cred.username) : '';
    const active = getActiveLicense();
    const card = active?.licenseKey ? String(active.licenseKey) : '';
    const brand = currentBrand?.name || currentBrand?.id || '';
    const version = currentBrand?.version || import.meta.env?.VITE_APP_VERSION || import.meta.env?.VITE_VERSION || '';
    const developedBy = currentBrand?.developedBy ? String(currentBrand.developedBy) : '';
    const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone || '';
    const parts = [
      appName || t('settings.about.app', { defaultValue: 'App' }),
      brand ? `${t('settings.about.brand', { defaultValue: 'Marca' })}: ${brand}` : null,
      version ? `${t('settings.about.version', { defaultValue: 'Versión' })}: ${version}` : null,
      username ? `${t('settings.about.username', { defaultValue: 'Usuario' })}: ${username}` : null,
      card ? `${t('settings.about.smartcard', { defaultValue: 'Smartcard' })}: ${card}` : null,
      developedBy ? `${t('settings.about.developedBy', { defaultValue: 'Desarrollado por' })}: ${developedBy}` : null,
      timezone ? `${t('settings.about.timezone', { defaultValue: 'Zona horaria' })}: ${timezone}` : null,
    ].filter(Boolean);
    return parts.join(' · ');
  }, [appName, currentBrand, t]);

  const handleRefresh = () => {
    const redirect = location.pathname?.startsWith('/home/') ? location.pathname : '/home/inicio';
    navigate(`/preload?redirect=${encodeURIComponent(redirect)}`);
  };

  const handleLogout = async () => {
    try {
      await panaccessService.logout?.();
    } catch {
      // noop
    }
    setLoggedOut();
    navigate('/login', { replace: true });
  };

  const handleExit = () => {
    // Best-effort. En TVs, el shell nativo puede interceptar/ignorar.
    try {
      const tizenApp = window?.tizen?.application?.getCurrentApplication?.();
      if (tizenApp?.exit) {
        tizenApp.exit();
        return;
      }
    } catch {
      // noop
    }
    try {
      window.close();
    } catch {
      // noop
    }
  };

  const setExpandedSafe = (next) => {
    if (typeof onExpandedChange === 'function') {
      onExpandedChange(Boolean(next));
    }
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
    };
  }, []);

  // Si el sidebar se colapsa, cerrar cualquier desplegable asociado.
  useEffect(() => {
    if (expanded) return;
    setSettingsOpen(false);
    setAboutModal(false);
    setConfirmAction(null);
  }, [expanded]);

  return (
    <aside
      ref={rootRef}
      className={[
        'home-sidebar',
        expanded ? '' : 'home-sidebar--collapsed',
        sidebarFixed ? 'home-sidebar--fixed' : '',
      ].filter(Boolean).join(' ')}
      aria-label={t('sidebar.menu')}
      onFocusCapture={() => setExpandedSafe(true)}
      onBlurCapture={scheduleCollapseIfOutside}
      onMouseEnter={() => setExpandedSafe(true)}
      onMouseLeave={() => scheduleCollapseIfOutside()}
    >
      <ConfirmModal
        open={aboutModal}
        title={t('settings.about.title', { defaultValue: 'Acerca de' })}
        message={aboutMessage}
        confirmText={t('common.close', { defaultValue: 'Cerrar' })}
        onConfirm={() => setAboutModal(false)}
      />

      <ConfirmModal
        open={confirmAction === 'logout'}
        title={t('settings.logoutConfirmTitle', { defaultValue: 'Cerrar sesión' })}
        message={t('settings.logoutConfirmMessage', { defaultValue: '¿Deseas cerrar sesión en este dispositivo?' })}
        confirmText={t('settings.confirm', { defaultValue: 'Confirmar' })}
        cancelText={t('settings.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={() => {
          setConfirmAction(null);
          handleLogout();
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmModal
        open={confirmAction === 'exit'}
        title={t('settings.exitConfirmTitle', { defaultValue: 'Salir' })}
        message={t('settings.exitConfirmMessage', { defaultValue: '¿Deseas salir de la aplicación?' })}
        confirmText={t('settings.confirm', { defaultValue: 'Confirmar' })}
        cancelText={t('settings.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={() => {
          setConfirmAction(null);
          handleExit();
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <div className="home-sidebar-header">{appName || 'App'}</div>
      <nav className="home-sidebar-nav">
        <SidebarLink to="/home/inicio" label={t('sidebar.bouquets')} icon="home" />
        {showVod && <SidebarLink to="/home/vod" label={t('sidebar.movies')} icon="movies" />}
        <SidebarLink to="/home/epg" label={t('sidebar.channelGuide')} icon="guide" />
        {showTvRadioServices && (
          <SidebarLink to="/home/servicios-tv-radio" label={t('sidebar.tvRadioServices')} icon="channels" />
        )}
        {showCatchup && (
          <SidebarLink to="/home/catchup" label={t('sidebar.catchup')} />
        )}
        {currentBrand?.features?.osms && (
          <SidebarLink to="/home/osms" label={t('sidebar.osms')} />
        )}

        <div className="home-sidebar-settings">
          <button
            type="button"
            className={`home-sidebar-link home-sidebar-settings-btn${settingsOpen ? ' active' : ''}`}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <SidebarIcon name="settings" />
            <span className="home-sidebar-label">
              {t('common.settings', { defaultValue: 'Configuración' })}
            </span>
          </button>
          {settingsOpen && (
            <div
              className="home-sidebar-submenu home-sidebar-submenu--right"
              role="group"
              aria-label={t('common.settings', { defaultValue: 'Configuración' })}
            >
              <button type="button" className="home-sidebar-sublink" onClick={() => setAboutModal(true)}>
                {t('common.about', { defaultValue: 'Acerca de' })}
              </button>
              <button type="button" className="home-sidebar-sublink" onClick={handleRefresh}>
                {t('common.refresh', { defaultValue: 'Refrescar' })}
              </button>
              <button type="button" className="home-sidebar-sublink" onClick={() => setConfirmAction('logout')}>
                {t('common.logout', { defaultValue: 'Cerrar sesión' })}
              </button>
              <button type="button" className="home-sidebar-sublink home-sidebar-sublink--danger" onClick={() => setConfirmAction('exit')}>
                {t('common.exit', { defaultValue: 'Salir' })}
              </button>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;

