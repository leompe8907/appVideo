import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { usePreload } from '../store/usePreload';
import { useOsmsStore } from '../store/osmsStore';
import panaccessService from '../services/panaccessService';
import { hasTvRadioServiceBouquets } from '../services/tvDataService';
import { setLoggedOut, getActiveLicense, getCredentials } from '../utils/userSession';
import ConfirmModal from './ConfirmModal';

function SidebarIcon({ name }) {
  const common = {
    className: 'home-sidebar-icon',
    width: 18,
    height: 18,
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    focusable: false,
  };

  const material = (d) => (
    <svg {...common} viewBox="0 -960 960 960" fill="currentColor">
      <path d={d} />
    </svg>
  );

  switch (name) {
    case 'osms':
      // src/constants/sidebar/mail_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material(
        'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z'
      );
    case 'search':
      // src/constants/sidebar/search_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material(
        'M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z'
      );
    case 'channels':
      // src/constants/sidebar/smalltv_102218.svg
      return (
        <svg {...common} viewBox="0 0 224 228.0015" fill="currentColor">
          <g>
            <circle fill="none" cx="188" cy="152.0015" r="4" />
            <circle fill="none" cx="188" cy="120.0015" r="4" />
            <rect x="24" y="108.0015" fill="none" width="128" height="96" />
            <path
              fill="none"
              d="M211.992,92.0015H12.008c-2.2113,0-4.008,1.7948-4.008,4v120c0,2.2052,1.7967,4,4.008,4h199.984
		c2.2111,0,4.008-1.7948,4.008-4v-120C216,93.7963,214.2031,92.0015,211.992,92.0015z M160,212.0015H16v-112h144V212.0015z
		 M188,164.0015c-6.6173,0-12-5.3828-12-12s5.3827-12,12-12c6.6171,0,12,5.3828,12,12S194.6171,164.0015,188,164.0015z
		 M188,132.0015c-6.6173,0-12-5.3828-12-12c0-6.6172,5.3827-12,12-12c6.6171,0,12,5.3828,12,12
		C200,126.6187,194.6171,132.0015,188,132.0015z"
            />
            <path
              fill="none"
              d="M94,76.0015c-4.8305,0-8.8689,3.4416-9.7981,8h19.596C102.8687,79.4431,98.8303,76.0015,94,76.0015z"
            />
            <path d="M211.992,84.0015H111.7979c-0.6616-5.8784-4.12-10.8652-9.0556-13.6368l48.4452-63.9472
		c1.336-1.7616,0.988-4.2696-0.7736-5.6036c-1.7656-1.3396-4.2732-0.9864-5.6016,0.7716l-50,66
		c-0.1108,0.1464-0.1412,0.32-0.2292,0.4752c-0.198-0.0064-0.3836-0.0592-0.5831-0.0592c-0.1997,0-0.3853,0.0528-0.5833,0.0592
		c-0.088-0.1552-0.1184-0.3288-0.2292-0.4752l-50-66c-1.332-1.758-3.84-2.1112-5.6016-0.7716
		c-1.7616,1.334-2.1096,3.842-0.7736,5.6036l48.4452,63.9472c-4.9356,2.7716-8.394,7.7584-9.0556,13.6368H12.008
		c-6.6213,0-12.008,5.3828-12.008,12v120c0,6.6172,5.3867,12,12.008,12h199.984c6.6211,0,12.008-5.3828,12.008-12v-120
		C224,89.3843,218.6131,84.0015,211.992,84.0015z M94,76.0015c4.8303,0,8.8687,3.4416,9.7979,8h-19.596
		C85.1311,79.4431,89.1695,76.0015,94,76.0015z M216,216.0015c0,2.2052-1.7969,4-4.008,4H12.008c-2.2113,0-4.008-1.7948-4.008-4
		v-120c0-2.2052,1.7967-4,4.008-4h199.984c2.2111,0,4.008,1.7948,4.008,4V216.0015z" />
            <path d="M16,212.0015h144v-112H16V212.0015z M24,108.0015h128v96H24V108.0015z" />
            <path d="M188,108.0015c-6.6173,0-12,5.3828-12,12c0,6.6172,5.3827,12,12,12c6.6171,0,12-5.3828,12-12
		C200,113.3843,194.6171,108.0015,188,108.0015z M188,124.0015c-2.2073,0-4-1.7948-4-4s1.7927-4,4-4c2.2071,0,4,1.7948,4,4
		S190.2071,124.0015,188,124.0015z" />
            <path d="M188,140.0015c-6.6173,0-12,5.3828-12,12s5.3827,12,12,12c6.6171,0,12-5.3828,12-12S194.6171,140.0015,188,140.0015z
		 M188,156.0015c-2.2073,0-4-1.7948-4-4s1.7927-4,4-4c2.2071,0,4,1.7948,4,4S190.2071,156.0015,188,156.0015z" />
          </g>
        </svg>
      );
    case 'catchup':
      // src/constants/sidebar/replay_filled_icon_200351.svg
      return (
        <svg {...common} viewBox="0 0 20 20" fill="currentColor">
          <path d="M2.99985 6.49997L3 3.5C3 3.22386 3.22386 3 3.5 3C3.77614 3 4 3.22386 4 3.5V4.70712C4.84191 3.75214 5.91369 2.99357 7.14446 2.52475C7.85525 2.25305 8.61475 2.07978 9.40629 2.0217C10.2767 1.95622 11.1287 2.034 11.9375 2.23622C15.4196 3.10238 18 6.24985 18 10C18 10.029 17.9998 10.0581 17.9995 10.087C17.9961 10.441 17.9692 10.7906 17.9202 11.1344C17.6504 13.0351 16.7125 14.7209 15.3519 15.9463C14.8422 16.406 14.2711 16.8023 13.6495 17.1209C12.696 17.6106 11.6313 17.9144 10.5032 17.9844C9.47799 18.0503 8.47953 17.9176 7.5486 17.6174C6.75531 17.3623 6.01605 16.9868 5.35236 16.5122C3.64045 15.2903 2.41114 13.4 2.08339 11.1593C2.07981 11.1348 2.07633 11.1103 2.07296 11.0857C1.99882 10.5444 1.98067 10.0079 2.01426 9.48208C2.03186 9.2065 2.26953 8.99737 2.54511 9.01497C2.82069 9.03258 3.02982 9.27025 3.01222 9.54583C3.00353 9.68186 2.9988 9.81878 2.99813 9.95645C2.99937 9.9708 3 9.98533 3 10C3 13.1002 5.01541 15.7297 7.80751 16.6498C8.49717 16.877 9.23423 17 10 17C10.1463 17 10.2916 16.9955 10.4358 16.9867C10.6061 16.9758 10.7772 16.9587 10.949 16.9352C11.7861 16.8205 12.5682 16.5623 13.274 16.1887C15.7974 14.8531 17.3442 12.0431 16.9342 9.04998C16.5332 6.12245 14.3763 3.86706 11.6716 3.20085C11.136 3.0696 10.5761 3 10 3C9.82476 3 9.65102 3.00644 9.479 3.01909C9.33617 3.02986 9.19276 3.04505 9.04894 3.06475C8.5281 3.1361 8.02859 3.26296 7.55552 3.43859C6.21154 3.93946 5.06273 4.84155 4.25465 5.99997H6C6.27614 5.99997 6.5 6.22386 6.5 6.5C6.5 6.77614 6.27614 7 6 7H3.5C3.46438 7 3.42962 6.99627 3.39611 6.98919C3.16975 6.94143 2.99985 6.74054 2.99985 6.49997ZM7.5 7.96702C7.5 7.03638 8.48059 6.43209 9.3119 6.85043L13.3518 8.8834C14.2692 9.34509 14.2692 10.6549 13.3518 11.1166L9.3119 13.1495C8.48059 13.5679 7.5 12.9636 7.5 12.033V7.96702Z" />
        </svg>
      );
    case 'movies':
      // src/constants/general/movie_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material(
        'm160-800 80 160h120l-80-160h80l80 160h120l-80-160h80l80 160h120l-80-160h120q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800Zm0 240v320h640v-320H160Zm0 0v320-320Z'
      );
    case 'guide':
      // src/constants/sidebar/menu_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material('M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z');
    case 'home':
      // src/constants/sidebar/home_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material(
        'M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z'
      );
    case 'settings':
      // src/constants/sidebar/settings_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material(
        'm370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z'
      );
    default:
      return null;
  }
}

function SidebarLink({ to, label, icon, onSelect }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `home-sidebar-link${isActive ? ' active' : ''}`}
      onClick={() => onSelect?.()}
    >
      {icon ? <SidebarIcon name={icon} /> : null}
      <span className="home-sidebar-label">{label}</span>
    </NavLink>
  );
}

function SidebarLinkWithBadge({ to, label, icon, badge, onSelect }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `home-sidebar-link${isActive ? ' active' : ''}`}
      onClick={() => onSelect?.()}
    >
      {icon ? <SidebarIcon name={icon} /> : null}
      <span className="home-sidebar-label">{label}</span>
      {badge != null && badge !== 0 && (
        <span className="home-sidebar-badge" aria-label={String(badge)}>
          {badge}
        </span>
      )}
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
  /** Evita colapsar el rail cuando hay modal en portal (foco fuera del aside). */
  const blockCollapseForOverlayRef = useRef(false);
  const sidebarFixed = currentBrand?.ui?.sidebar?.fixed !== false;
  blockCollapseForOverlayRef.current = Boolean(aboutModal || confirmAction);

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

  const collapseSidebar = () => setExpandedSafe(false);

  const scheduleCollapseIfOutside = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      if (blockCollapseForOverlayRef.current) return;
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

  // Si el sidebar se colapsa, cerrar el submenú (los modales van en portal: no tocarlos).
  useEffect(() => {
    if (expanded) return;
    setSettingsOpen(false);
  }, [expanded]);

  // Si la ruta cambia (navegación desde cualquier origen), colapsar el sidebar.
  useEffect(() => {
    collapseSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
        <SidebarLink to="/home/inicio" label={t('sidebar.bouquets')} icon="home" onSelect={collapseSidebar} />
        <SidebarLink to="/home/buscador" label={t('sidebar.search', { defaultValue: 'Buscador' })} icon="search" onSelect={collapseSidebar} />
        {showVod && <SidebarLink to="/home/vod" label={t('sidebar.movies')} icon="movies" onSelect={collapseSidebar} />}
        <SidebarLink to="/home/epg" label={t('sidebar.channelGuide')} icon="guide" onSelect={collapseSidebar} />
        {showTvRadioServices && (
          <SidebarLink to="/home/servicios-tv-radio" label={t('sidebar.tvRadioServices')} icon="channels" onSelect={collapseSidebar} />
        )}
        {showCatchup && (
          <SidebarLink to="/home/catchup" label={t('sidebar.catchup')} icon="catchup" onSelect={collapseSidebar} />
        )}
        {currentBrand?.features?.osms && (
          <SidebarLinkWithBadge
            to="/home/osms"
            label={t('sidebar.osms')}
            icon="osms"
            onSelect={collapseSidebar}
            badge={osmsUnreadCount}
          />
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
              <button
                type="button"
                className="home-sidebar-sublink"
                onClick={() => {
                  navigate('/home/control-parental');
                  collapseSidebar();
                }}
              >
                {t('parental.title', { defaultValue: 'Control parental' })}
              </button>
              <button
                type="button"
                className="home-sidebar-sublink"
                onClick={() => {
                  setAboutModal(true);
                  collapseSidebar();
                }}
              >
                {t('common.about', { defaultValue: 'Acerca de' })}
              </button>
              <button
                type="button"
                className="home-sidebar-sublink"
                onClick={() => {
                  handleRefresh();
                  collapseSidebar();
                }}
              >
                {t('common.refresh', { defaultValue: 'Refrescar' })}
              </button>
              <button
                type="button"
                className="home-sidebar-sublink"
                onClick={() => {
                  setConfirmAction('logout');
                  collapseSidebar();
                }}
              >
                {t('common.logout', { defaultValue: 'Cerrar sesión' })}
              </button>
              <button
                type="button"
                className="home-sidebar-sublink home-sidebar-sublink--danger"
                onClick={() => {
                  setConfirmAction('exit');
                  collapseSidebar();
                }}
              >
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

