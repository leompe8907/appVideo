import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { usePreload } from '../store/usePreload';
import { useOsmsStore } from '../store/osmsStore';
import { hasTvRadioServiceBouquets } from '../services/tvDataService';
import { getSubscriberName } from '../utils/userSession';
import { TV_ACTION } from '../utils/tvRemote';
import { navigationRouter } from '../navigation/NavigationRouter';
import { focusFirstIn, moveFocus, scrollIntoViewWithinAncestors } from '../navigation/spatialNavigation';
import { requestTvFocusRingSync } from './navigation/TvFocusRing';

function SidebarIcon({ name }) {
  const common = {
    className: 'home-sidebar-icon',
    width: 18,
    height: 18,
    xmlns: 'http://www.w3.org/2000/svg',
    fill: 'currentColor',
    'aria-hidden': true,
    focusable: false,
  };

  const material = (d) => (
    <svg {...common} viewBox="0 -960 960 960">
      <path d={d} />
    </svg>
  );

  switch (name) {
    case 'account':
      // src/constants/sidebar/Cuenta - Blanco.svg
      return (
        <svg {...common} viewBox="0 0 314 314">
          <path d="M249.299 245.067C237.585 216.427 209.436 196.25 176.625 196.25H137.375C104.564 196.25 76.4148 216.427 64.7012 245.067C42.8684 222.192 29.4375 191.16 29.4375 157C29.4375 86.534 86.534 29.4375 157 29.4375C227.466 29.4375 284.562 86.534 284.562 157C284.562 191.16 271.132 222.13 249.299 245.067ZM224.706 265.121C205.081 277.448 181.899 284.562 157 284.562C132.101 284.562 108.919 277.448 89.2324 265.121C93.7094 242.614 113.58 225.688 137.375 225.688H176.625C200.42 225.688 220.291 242.614 224.768 265.121H224.706ZM157 314C243.718 314 314 243.718 314 157C314 70.282 243.718 0 157 0C70.282 0 0 70.282 0 157C0 243.718 70.282 314 157 314ZM157 147.188C143.446 147.188 132.469 136.21 132.469 122.656C132.469 109.103 143.446 98.125 157 98.125C170.554 98.125 181.531 109.103 181.531 122.656C181.531 136.21 170.554 147.188 157 147.188ZM103.031 122.656C103.031 152.462 127.195 176.625 157 176.625C186.805 176.625 210.969 152.462 210.969 122.656C210.969 92.8508 186.805 68.6875 157 68.6875C127.195 68.6875 103.031 92.8508 103.031 122.656Z" />
        </svg>
      );
    case 'osms':
      // src/constants/sidebar/mail_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material(
        'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z'
      );
    case 'search':
      // src/constants/sidebar/Buscar - Blanco.svg
      return (
        <svg {...common} viewBox="0 0 314 314">
          <path d="M127.139 0.0334579C160.607 -0.725571 193.077 11.4549 217.8 34.0269C242.521 56.5997 257.6 87.8314 259.88 121.23C261.814 149.569 254.39 177.602 239.01 201.159C235.669 206.277 236.043 213.109 240.365 217.43L310.449 287.514C315.184 292.249 315.184 299.926 310.449 304.661L304.661 310.449C299.926 315.184 292.249 315.184 287.514 310.449L217.43 240.365C213.108 236.043 206.277 235.669 201.159 239.01C177.602 254.39 149.57 261.814 121.23 259.88C87.8314 257.6 56.5997 242.521 34.0268 217.8C11.4551 193.078 -0.725342 160.606 0.0334365 127.139C0.793928 93.6692 14.4274 61.7727 38.0999 38.0999C61.7727 14.4271 93.6689 0.793955 127.139 0.0334579ZM149.304 34.7136C130.402 30.9539 110.808 32.881 93.0032 40.2548C75.1965 47.6306 59.9732 60.1289 49.2653 76.1545C38.5593 92.1784 32.8436 111.017 32.8428 130.288L32.9612 135.119C34.1817 159.194 44.2884 182.036 61.4134 199.163C79.6812 217.43 104.455 227.703 130.288 227.734C149.561 227.733 168.409 222.03 184.434 211.323C200.458 200.616 212.946 185.39 220.322 167.585C227.696 149.781 229.633 130.186 225.875 111.285C222.115 92.3832 212.825 75.0177 199.199 61.3897C185.571 47.7617 168.206 38.4741 149.304 34.7136Z" />
        </svg>
      );
    case 'channels':
      // src/constants/sidebar/Canales - Blanco.svg
      return (
        <svg {...common} viewBox="0 0 314 314">
          <path d="M219.776 3.80948C224.784 -1.20217 232.985 -1.27892 238.093 3.63468C243.198 8.55194 243.276 16.6068 238.27 21.622L187.835 72.1318H272.237C295.545 72.1319 313.999 90.9878 314 113.707V272.425C313.997 295.143 295.544 314 272.237 314H41.7637C18.4571 314 0.00272009 295.143 0 272.425V113.707C0.00139623 90.9877 18.4563 72.1318 41.7637 72.1318H126.166L75.7305 21.622C70.724 16.6068 70.8032 8.55181 75.9082 3.63468C81.0162 -1.2788 89.216 -1.20201 94.2236 3.80948L157 66.6933L219.776 3.80948ZM41.7637 97.5693C33.2502 97.5693 25.9096 104.555 25.9082 113.707V272.424C25.9106 281.574 33.2508 288.562 41.7637 288.562H272.237C280.75 288.562 288.089 281.575 288.092 272.425V113.707C288.09 104.555 280.751 97.5695 272.237 97.5693H157.266C157.226 97.5701 157.186 97.5732 157.142 97.5761C157.098 97.5789 157.049 97.5819 157 97.5819C156.951 97.5819 156.903 97.5789 156.859 97.5761C156.814 97.5732 156.774 97.5701 156.734 97.5693H41.7637Z" />
        </svg>
      );
    case 'catchup':
      // src/constants/sidebar/replay_filled_icon_200351.svg
      return (
        <svg {...common} viewBox="0 0 20 20">
          <path d="M2.99985 6.49997L3 3.5C3 3.22386 3.22386 3 3.5 3C3.77614 3 4 3.22386 4 3.5V4.70712C4.84191 3.75214 5.91369 2.99357 7.14446 2.52475C7.85525 2.25305 8.61475 2.07978 9.40629 2.0217C10.2767 1.95622 11.1287 2.034 11.9375 2.23622C15.4196 3.10238 18 6.24985 18 10C18 10.029 17.9998 10.0581 17.9995 10.087C17.9961 10.441 17.9692 10.7906 17.9202 11.1344C17.6504 13.0351 16.7125 14.7209 15.3519 15.9463C14.8422 16.406 14.2711 16.8023 13.6495 17.1209C12.696 17.6106 11.6313 17.9144 10.5032 17.9844C9.47799 18.0503 8.47953 17.9176 7.5486 17.6174C6.75531 17.3623 6.01605 16.9868 5.35236 16.5122C3.64045 15.2903 2.41114 13.4 2.08339 11.1593C2.07981 11.1348 2.07633 11.1103 2.07296 11.0857C1.99882 10.5444 1.98067 10.0079 2.01426 9.48208C2.03186 9.2065 2.26953 8.99737 2.54511 9.01497C2.82069 9.03258 3.02982 9.27025 3.01222 9.54583C3.00353 9.68186 2.9988 9.81878 2.99813 9.95645C2.99937 9.9708 3 9.98533 3 10C3 13.1002 5.01541 15.7297 7.80751 16.6498C8.49717 16.877 9.23423 17 10 17C10.1463 17 10.2916 16.9955 10.4358 16.9867C10.6061 16.9758 10.7772 16.9587 10.949 16.9352C11.7861 16.8205 12.5682 16.5623 13.274 16.1887C15.7974 14.8531 17.3442 12.0431 16.9342 9.04998C16.5332 6.12245 14.3763 3.86706 11.6716 3.20085C11.136 3.0696 10.5761 3 10 3C9.82476 3 9.65102 3.00644 9.479 3.01909C9.33617 3.02986 9.19276 3.04505 9.04894 3.06475C8.5281 3.1361 8.02859 3.26296 7.55552 3.43859C6.21154 3.93946 5.06273 4.84155 4.25465 5.99997H6C6.27614 5.99997 6.5 6.22386 6.5 6.5C6.5 6.77614 6.27614 7 6 7H3.5C3.46438 7 3.42962 6.99627 3.39611 6.98919C3.16975 6.94143 2.99985 6.74054 2.99985 6.49997ZM7.5 7.96702C7.5 7.03638 8.48059 6.43209 9.3119 6.85043L13.3518 8.8834C14.2692 9.34509 14.2692 10.6549 13.3518 11.1166L9.3119 13.1495C8.48059 13.5679 7.5 12.9636 7.5 12.033V7.96702Z" />
        </svg>
      );
    case 'movies':
      // src/constants/sidebar/Películas - Blanco.svg
      return (
        <svg {...common} viewBox="0 0 314 314">
          <path d="M314 125.195V278.898C314 295.959 300.321 309.64 283.26 309.64H37.3349C29.1822 309.64 21.3635 306.401 15.5986 300.636C9.83362 294.871 6.5947 287.051 6.5947 278.898V125.195H314ZM49.6308 155.937C42.8401 155.937 37.335 161.442 37.3349 168.232V266.603C37.3349 273.393 42.84 278.898 49.6308 278.898H270.964C277.755 278.898 283.26 273.393 283.26 266.603V168.232C283.26 161.442 277.755 155.937 270.964 155.937H49.6308ZM81.9092 110.286L6.5947 125.195L0.59958 95.0703C-0.194782 91.1137 -0.199663 87.0389 0.583955 83.0801C1.36762 79.1212 2.92507 75.3557 5.16696 72C7.40884 68.6443 10.2911 65.7638 13.6484 63.5244C17.0057 61.2851 20.7721 59.731 24.7314 58.9502L39.7939 56.0293L81.9092 110.286ZM157.377 95.2236L127.251 101.218L84.9834 46.9609L115.263 40.6592L157.377 95.2236ZM232.691 80.1611L202.565 86.1553L160.298 31.8984L190.577 25.9033L232.691 80.1611ZM308.16 65.252L277.88 71.3994L235.766 16.9893L296.171 5L308.16 65.252Z" />
        </svg>
      );
    case 'guide':
      // src/constants/sidebar/menu_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg
      return material('M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z');
    case 'home':
      // src/constants/sidebar/Home - Blanco.svg
      return (
        <svg {...common} viewBox="0 0 314 314">
          <path d="M168.189 4.64269C166.73 3.17158 164.994 2.00393 163.081 1.20709C161.169 0.410251 159.117 0 157.045 0C154.973 0 152.922 0.410251 151.009 1.20709C149.097 2.00393 147.361 3.17158 145.902 4.64269L4.64268 145.902C3.17157 147.361 2.00392 149.097 1.20709 151.009C0.410251 152.922 0 154.974 0 157.046C0 159.117 0.410251 161.169 1.20709 163.082C2.00392 164.994 3.17157 166.73 4.64268 168.189C6.10927 169.644 7.84857 170.795 9.76086 171.576C11.6732 172.357 13.7208 172.753 15.7864 172.741H31.4819V282.609C31.4819 290.934 34.7891 298.919 40.6761 304.806C46.563 310.693 54.5474 314 62.8728 314H251.218C259.543 314 267.528 310.693 273.415 304.806C279.302 298.919 282.609 290.934 282.609 282.609V172.741H298.304C302.467 172.741 306.459 171.087 309.403 168.144C312.346 165.2 314 161.208 314 157.046C314.012 154.98 313.616 152.932 312.835 151.02C312.054 149.108 310.903 147.368 309.448 145.902L168.189 4.64269ZM62.8728 282.609V132.09L157.045 37.917L251.218 132.09V282.609H62.8728Z" />
        </svg>
      );
    case 'settings':
      // src/constants/sidebar/Configuración - Blanco.svg
      return (
        <svg {...common} viewBox="0 0 314 314">
          <path d="M173.346 1C180.053 1.00011 185.821 5.63695 187.971 11.3135L188.168 11.8662V11.8691L196.883 38.9805L211.249 44.7275L236.427 31.1709L236.434 31.167C242.358 28.2051 250.254 29.1898 255.195 34.1309L278.53 57.4658C283.472 62.4073 284.456 70.3037 281.494 76.2285L281.491 76.2354H281.49L267.934 101.412L273.681 115.778L300.793 124.493H300.792C307.705 126.472 312.634 133.377 312.634 140.288V173.346C312.634 180.27 307.693 186.193 301.768 188.168L301.763 188.169L273.68 196.884L267.934 211.249L281.49 236.427L281.494 236.434C284.456 242.358 283.471 250.254 278.53 255.195L255.195 278.53C250.254 283.472 242.358 284.456 236.434 281.494L236.427 281.491V281.49L211.249 267.934L196.884 273.68L188.169 301.763L188.168 301.768C186.193 307.693 180.27 312.634 173.346 312.634H140.288C133.364 312.634 127.442 307.693 125.467 301.768L125.465 301.763L116.749 273.68L102.384 267.934L77.207 281.49L77.2012 281.494C71.2763 284.457 63.38 283.472 58.4385 278.53L35.1035 255.195C30.1621 250.254 29.1774 242.358 32.1396 236.434L32.1436 236.427L45.6992 211.25L39.9521 196.882L12.8486 188.17C5.94953 186.199 1 180.277 1 173.346V140.288C1.00015 133.364 5.94103 127.442 11.8662 125.467L11.8691 125.466L38.9795 116.751C39.6965 114.953 40.4144 113.024 41.1328 111.061L42.5703 107.117C43.2892 105.151 44.0087 103.216 44.7285 101.411L32.1416 77.2041L32.1396 77.2012C29.1773 71.2763 30.162 63.38 35.1035 58.4385L58.4385 35.1035C63.2256 30.3166 70.7853 29.2431 76.6396 31.874L77.2012 32.1396L77.207 32.1436L102.362 45.6885C107.165 42.8231 111.981 40.8999 117.733 39.9219L126.433 12.8555C127.435 5.93613 133.371 1 140.288 1H173.346ZM132.748 54.8008L132.713 54.9141L132.603 54.958L127.741 56.9033L127.726 56.9092L127.709 56.9131C119.956 58.8513 113.171 61.7592 106.382 65.6387L101.524 68.5527L101.4 68.627L101.273 68.5557L70.3252 51.1475L51.1426 70.3301L67.5879 102.254L67.6523 102.378L67.5801 102.497L64.665 107.354L64.666 107.354C60.7867 114.143 57.8796 120.928 55.9414 128.681L55.9365 128.697L55.9307 128.713L53.9863 133.575L53.9404 133.688L53.8242 133.722L20.9463 143.391V170.244L55.7715 180.885L55.9141 180.929L55.9434 181.075L56.9141 185.927C58.8521 192.707 61.7587 199.49 65.6357 206.275L68.5527 211.137L68.626 211.26L68.5576 211.385L51.1455 243.306L70.3271 262.487L102.249 245.076L102.374 245.008L102.497 245.081L107.343 247.988L127.722 256.723L132.559 257.69L132.705 257.72L132.749 257.862L143.391 292.688H170.244L180.885 257.862L180.929 257.72L181.075 257.69L185.927 256.719C192.708 254.78 199.493 251.873 206.28 247.995L211.137 245.081L211.26 245.008L211.385 245.076L243.306 262.487L262.487 243.306L245.076 211.385L245.008 211.26L245.081 211.137L247.988 206.29L256.723 185.912L257.69 181.075L257.72 180.929L257.862 180.885L292.688 170.244V143.39L257.862 132.749L257.72 132.705L257.69 132.559L256.719 127.706C254.78 120.925 251.873 114.141 247.995 107.354V107.354L245.081 102.497L245.008 102.374L245.076 102.249L262.487 70.3271L243.306 51.1455L211.385 68.5576L211.26 68.626L211.137 68.5527L206.28 65.6387L205.007 64.9219C198.641 61.398 192.278 58.7285 185.917 56.9111L185.905 56.9072L185.893 56.9033L181.031 54.958L180.921 54.9141L180.886 54.8008L170.246 20.9463H143.388L132.748 54.8008ZM157.789 88.5068C195.846 88.507 226.099 118.76 226.1 156.817C226.099 194.875 195.846 225.128 157.789 225.128C119.732 225.128 89.4787 194.875 89.4785 156.817C89.4787 118.76 119.732 88.5069 157.789 88.5068ZM157.789 108.452C130.703 108.452 109.425 129.731 109.425 156.817C109.425 183.903 130.703 205.182 157.789 205.182C184.875 205.182 206.154 183.903 206.154 156.817C206.154 129.731 184.875 108.452 157.789 108.452Z" />
        </svg>
      );
    default:
      return null;
  }
}

function SidebarLink({ to, label, icon, onSelect, currentPathname, navigate }) {
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
  const { isTV } = useDevice();
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const { currentBrand } = useBrand();
  const { vod, catchup, epg } = usePreload();
  const subscriberName = getSubscriberName();
  const blurTimerRef = useRef(null);
  const tvMainFocusCancelRef = useRef(null);
  const pendingTvNavFocusRef = useRef(false);
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

  const osmsUnreadCount = useOsmsStore((s) => s.unreadCount);

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
            aria-label={subscriberName || t('sidebar.account', { defaultValue: 'Cuenta' })}
            onClick={(e) => {
              if (location.pathname === '/home/mi-cuenta') {
                e.preventDefault();
                navigate('/home/mi-cuenta', { replace: true, state: { _navNonce: Date.now() } });
              }
              collapseAfterNav();
            }}
          >
            <SidebarIcon name="account" />
            <span className="home-sidebar-label">
              {subscriberName || t('sidebar.account', { defaultValue: 'Cuenta' })}
            </span>
            {currentBrand?.features?.osms && osmsUnreadCount > 0 ? (
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
          <SidebarLink
            to="/home/buscador"
            label={t('sidebar.search', { defaultValue: 'Buscar' })}
            icon="search"
            onSelect={collapseAfterNav}
            currentPathname={location.pathname}
            navigate={navigate}
          />
          <SidebarLink
            to="/home/inicio"
            label={t('sidebar.bouquets', { defaultValue: 'Inicio' })}
            icon="home"
            onSelect={collapseAfterNav}
            currentPathname={location.pathname}
            navigate={navigate}
          />
          {showTvRadioServices ? (
            <SidebarLink
              to="/home/servicios-tv-radio"
              label={t('sidebar.tvRadioServices', { defaultValue: 'Canales' })}
              icon="channels"
              onSelect={collapseAfterNav}
              currentPathname={location.pathname}
              navigate={navigate}
            />
          ) : null}
          {showVod ? (
            <SidebarLink
              to="/home/vod"
              label={t('sidebar.movies', { defaultValue: 'Películas' })}
              icon="movies"
              onSelect={collapseAfterNav}
              currentPathname={location.pathname}
              navigate={navigate}
            />
          ) : null}
          <SidebarLink
            to="/home/epg"
            label={t('sidebar.channelGuide', { defaultValue: 'Guía' })}
            icon="guide"
            onSelect={collapseAfterNav}
            currentPathname={location.pathname}
            navigate={navigate}
          />
          {showCatchup ? (
            <SidebarLink
              to="/home/catchup"
              label={t('sidebar.catchup')}
              icon="catchup"
              onSelect={collapseAfterNav}
              currentPathname={location.pathname}
              navigate={navigate}
            />
          ) : null}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;

