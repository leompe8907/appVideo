/**
 * Configuración de marcas (brands) de la aplicación.
 *
 * Cada objeto de marca define:
 *
 * @param {string} brand - Identificador único de la marca (slug), usado para seleccionar la configuración activa.
 * @param {string} appName - Nombre visible de la aplicación que se muestra en la UI.
 * @param {string} drm - URL base del servicio DRM/backend (ej. Panaccess, inTV) para autenticación y contenido.
 * @param {string} token - Token de API o clave para autenticar las peticiones contra el servicio DRM.
 * @param {string} developedBy - Texto o HTML del crédito "Desarrollado por" (puede incluir entidades como &#174).
 * @param {string} version - Número de versión de la app para esta marca (ej. "1.0.2", "2.0.2").
 *
 * @param {Object} ui - Configuración de interfaz y tema:
 *   @param {number} ui.splashDuration - Tiempo en milisegundos que se muestra la pantalla de splash al iniciar.
 *   @param {boolean} ui.splashAnimado - true: usa imagen animada (.gif o video); false: usa imagen estática (.png/.webp/.jpg).
 *   @param {string|boolean} [ui.splashVideo] - Nombre del archivo de video para splash (ej: 'splash.mp4'). Solo aplica si splashAnimado es true. Si es true usa 'splash.mp4' por defecto.
 *   @param {string} ui.epgLineColorTime - Color (hex) de la línea de tiempo actual en la guía de programación (EPG).
 *   @param {string} ui.primaryColor - Color principal de la marca (botones, acentos, etc.).
 *   @param {string} ui.secondaryColor - Color secundario (hover, fondos, etc.).
 *   @param {string} ui.theme - Tema global: "dark" o "light".
 *   @param {string} ui.fontFamily - Familia de fuentes CSS (ej. "Arial, sans-serif", "Roboto, sans-serif").
 *   @param {Object} ui.sidebar - Configuración visual del sidebar Home.
 *     @param {string} ui.sidebar.backgroundColor - Fondo del sidebar.
 *     @param {string} ui.sidebar.textColor - Color del texto del sidebar.
 *     @param {string} ui.sidebar.submenuBackgroundColor - Fondo del submenú desplegable.
 *     @param {string} ui.sidebar.submenuTextColor - Color del texto del submenú desplegable.
 *     @param {boolean} ui.sidebar.fixed - true: sidebar sticky/fijo; false: normal (fluye con layout).
 *     @param {boolean} [ui.sidebar.showClientName=true] - Muestra el nombre del cliente en la cabecera del sidebar.
 *     @param {string} [ui.sidebar.clientName] - Texto personalizado; por defecto usa appName.
 *   @param {Object} ui.playerLoading - Estilo del overlay de carga de reproducción.
 *     @param {boolean} ui.playerLoading.premium - true: overlay premium (blur + gradientes + glow); false: overlay simple.
 *
 * @param {Object} features - Funcionalidades activas o no para esta marca:
 *   @param {boolean} features.profiles - true: tras login redirige a /profile; false: redirige a /smartcard.
 *   @param {boolean} features.showRating - true: muestra la clasificación/rating de contenido; false: la oculta.
 *   @param {boolean} features.osms - true: habilita la integración OSMS y su menú; false: la deshabilita.
 *
 * @param {Object} login - Bloque unificado de configuración del Login por marca.
 *   @param {Object} login.qrRegister - Registro por QR en Login:
 *     @param {boolean} login.qrRegister.enabled - Habilita/deshabilita el botón/modal de registro QR.
 *     @param {string} login.qrRegister.url - URL destino codificada en el QR.
 *   @param {Object} login.udid - Login por UDID:
 *     @param {boolean} login.udid.enabled - Habilita/deshabilita el login externo por UDID.
 *     @param {string} login.udid.baseUrl - Base del backend propio para request de UDID.
 *     @param {string} login.udid.requestPath - Path para solicitar código UDID (default recomendado: /udid/request-udid-manual/).
 *     @param {string} login.udid.wsUrl - WebSocket para esperar confirmación remota.
 *   @param {Object} login.socialLogin - Login social (Google / Facebook) por marca:
 *     @param {string} login.socialLogin.backendBaseUrl - Base del backend win (ej. http://127.0.0.1:8000); alternativa: VITE_SOCIAL_AUTH_BASE_URL.
 *     @param {Object} login.socialLogin.google - Google Identity + POST a /wind/auth/google/.
 *       @param {boolean} login.socialLogin.google.enabled - Muestra el botón (solo escritorio; en TV se oculta).
 *       @param {string} login.socialLogin.google.redirectUrl - Si es absoluta (http...), URL del POST; si empieza con /, path relativo a la base.
 *       @param {string} login.socialLogin.google.backendBaseUrl - Base solo para Google (opcional; si no, socialLogin.backendBaseUrl).
 *       @param {string} login.socialLogin.google.accessToken - OAuth client_id de Google (GIS); alternativa: VITE_GOOGLE_CLIENT_ID.
 *     @param {Object} login.socialLogin.facebook - Misma forma que google (enabled, redirectUrl, accessToken, backendBaseUrl).
 *
 * @param {boolean} hashPasswordBeforeLogin - true: hashear contraseña en cliente antes de enviar (ej. Panaccess);
 *   false: enviar contraseña en claro (ej. backends como intv).
 *
 * @param {Object} bouquets - Configuración visual específica para bouquets:
 *   @param {string} bouquets.timeshipColor - Color (hex) de la barra de progreso (timeship) en los bouquets.
 *
 * @param {Object} header - Cabecera de la pantalla Inicio (tres zonas horizontales: izquierda, centro, derecha).
 *   @param {Object} header.areas - Configuración por área (izq/centro/der).
 *     @param {Object} header.areas.left
 *     @param {Object} header.areas.center
 *     @param {Object} header.areas.right
 *       @param {boolean} header.areas.<area>.enabled - Habilita el área.
 *       @param {boolean} header.areas.<area>.showLogo - Muestra logo de la marca.
 *       @param {boolean} header.areas.<area>.showTime - Muestra hora del dispositivo.
 *       @param {'left'|'center'|'right'} header.areas.<area>.contentAlign - Alineación interna del contenido dentro del área.
 *   @param {Object} header.subheader - Sub-área debajo del header (3 columnas iguales).
 *     @param {Object} header.subheader.areas
 *       @param {Object} header.subheader.areas.<area>
 *         @param {boolean} header.subheader.areas.<area>.enabled
 *         @param {boolean} header.subheader.areas.<area>.showServiceInfo - Muestra info del canal enfocado (evento actual + siguiente).
 *         @param {'left'|'center'|'right'} header.subheader.areas.<area>.contentAlign - Alineación interna del contenido dentro del área.
 *
 * @param {Object} homeShell - Flags de UI por sección dentro de /home:
 *   @param {Object} homeShell.header - Habilita/deshabilita el header por módulo.
 *     @param {boolean} homeShell.header.inicio
 *     @param {boolean} homeShell.header.serviciosTvRadio
 *     @param {boolean} homeShell.header.vod
 *     @param {boolean} homeShell.header.catchup
 *   @param {Object} homeShell.ads - Habilita/deshabilita publicidad por módulo.
 *     Nota: por requerimiento actual, por defecto solo se activa en Inicio.
 *     @param {boolean} homeShell.ads.inicio
 *     @param {boolean} homeShell.ads.serviciosTvRadio
 *     @param {boolean} homeShell.ads.vod
 *     @param {boolean} homeShell.ads.catchup
 *
 * @param {Object} debug - Opciones de depuración (normalmente solo en desarrollo):
 *   @param {boolean} debug.spatialNav - true: activa logs en consola de la navegación espacial.
 *   @param {boolean} debug.spatialNavVisual - true: muestra marcos rojos de debug para la navegación espacial.
 *
 * @param {Object} vod - Configuración de la sección VOD:
 *   @param {string} vod.layout - Diseño de lista y detalle VOD: "hero" (actual, estilo Netflix/Disney+) | "classic" (estilo 10foot: mitad poster/info, abajo similar, series con episodios). Default: "hero".
 *   @param {Object} vod.vodDetail - Opciones del modal de detalle VOD (película/serie). Solo aplica cuando vod.layout === "hero".
 *     @param {number} vod.vodDetail.descriptionMaxLength - Caracteres máximos de la descripción antes de "Leer más" (0 = sin límite). Default: 180.
 *     @param {boolean} vod.vodDetail.showReleaseYear - Mostrar año de estreno en la metadata. Default: true.
 *     @param {boolean} vod.vodDetail.showDuration - Mostrar duración (min) en la metadata. Default: true.
 *     @param {boolean} vod.vodDetail.showParentalRating - Mostrar badge de clasificación por edades. Default: true.
 *     @param {boolean} vod.vodDetail.showCategories - Mostrar etiquetas de categorías. Default: true.
 *     @param {boolean} vod.vodDetail.showStarRating - Mostrar valoración en estrellas. Default: true (respeta features.showRating si existe).
 *     @param {boolean} vod.vodDetail.showDescription - Mostrar bloque de descripción. Default: true.
 *     @param {string|null} vod.vodDetail.playButtonColor - Color del botón Reproducir (hex/css). null = usar ui.primaryColor. Default: null.
 *     @param {string|null} vod.vodDetail.starRatingColor - Color de las estrellas rellenas (hex/css). null = usar playButtonColor o #e50914. Default: null.
 *     @param {number} vod.vodDetail.heroGradientOpacity - Opacidad del gradiente inferior del hero (0–1). Default: 0.95.
 *     @param {number} vod.vodDetail.posterWidthMin - Ancho mínimo del poster en px. Default: 100.
 *     @param {number} vod.vodDetail.posterWidthMax - Ancho máximo del poster en px. Default: 200.
 *     @param {string} vod.vodDetail.categoryTagBackground - Color/fondo de las etiquetas de categoría (css). Default: "rgba(255, 255, 255, 0.12)".
 *     @param {string} vod.vodDetail.categoryTagBorderColor - Borde de las etiquetas de categoría (css). Default: "rgba(255, 255, 255, 0.2)".
 *     @param {string} vod.vodDetail.parentalBadgeBorderColor - Borde del badge de clasificación por edades (css). Default: "rgba(255, 255, 255, 0.5)".
 *     @param {string} vod.vodDetail.contentPosition - Posición vertical del bloque de contenido (poster + info): "top" | "middle" | "bottom". Default: "bottom".
 *
 * @param {Object} parental - Configuración de Control Parental por marca:
 *   @param {number} parental.parentalControlMultiTtlMs - TTL (ms) para unlock temporal global cuando en el bouquet hay 2+ canales
 *     con `parentalControl:true`. Default: 40 minutos.
 *
 * @param {Object} EPG - Configuración de EPG por marca (guía + cards):
 *   @param {number} EPG.daysOffset
 *   @param {number} EPG.rowsOnInit
 *   @param {number} EPG.hoursLimit
 *   @param {string} EPG.epgLineColorTime - Color guía (alineado con ui.epgLineColorTime de la marca).
 *   @param {number} EPG.reminderLeadSeconds - Segundos antes de start para popup de recordatorio. Default: 60.
 *   @param {boolean} EPG.reminderShowWhilePlaying - Si true, el popup puede mostrarse con playback activo.
 *   @param {boolean} EPG.epgPast
 *   @param {boolean} EPG.epgPagesPastEnabled
 *   @param {string} EPG.epgCardsChannelActiveBg
 *   @param {string} EPG.epgCardsProgramLiveBg
 *   @param {string} EPG.epgCardsProgramLiveProgressBg
 *   @param {boolean} EPG.epgCardsLaterGlobal
 *   @param {boolean|'auto'} EPG.epgCloseModalOnPlayLive
 */
import { applyBrandRuntimePolicy } from './applyBrandRuntimePolicy.js';

export const BRANDS = [
  // Bromteck
  {
    brand: "bromteck",
    appName: "Bromteck",
    drm: "https://cv01.panaccess.com/",
    token: '',
    // Metadatos de integración con DRM (equivalentes al proyecto EPG clásico)
    os: 'HTML5',
    appVersion: '1',
    branding: 'Panaccess',
    developedBy: "Network Broadcast",
    version: "1.0.2",

    login: {
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)",// Fondo de la tarjeta del login
        submitBg: "#004c77",// Botón principal (Entrar)
        submitText: "#ffffff",// Texto del botón principal
        registerBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón de registro
        registerText: "#ffffff",// Texto del botón de registro
        udidBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón UDID
        udidText: "#ffffff",// Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)",// Fondo del botón de toggle
        toggleText: "rgba(255, 255, 255, 0.7)",// Texto del botón de toggle
        inputs: {
          // Inputs (usuario/contraseña) - personalizable por marca
          bg: "rgba(255, 255, 255, 0.1)",
          border: "rgba(255, 255, 255, 0.2)",
          text: "#ffffff",
          placeholder: "rgba(255, 255, 255, 0.4)",
          focusedBg: "rgba(255, 255, 255, 0.15)",
          focusedBorder: null,
          focusedShadow: null,
        },
        social: {
          // Botones login social (Google/Facebook)
          bg: "rgba(255, 255, 255, 0.08)",
          border: "rgba(255, 255, 255, 0.22)",
          text: "rgba(255, 255, 255, 0.92)",
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Fondo del botón cerrar modal
        modalCloseText: "#ffffff",// Texto del botón cerrar modal
      },
      backgroundImage: {
        // Personaliza el fondo del login por marca:
        // - assetPath: nombre de asset dentro de la carpeta de la marca (ej. "background.png", "login-bg.webp")
        enabled: true,
        assetPath: "backgroundalt.webp",
      },
      qrRegister: {
        enabled: true,
        url: "https://shop.fotelka.tv/?c=customer&p=register",
      },
      udid: {
        enabled: true,
        baseUrl: "http://127.0.0.1:8001", //"https://bt-auth.cabledelancer.com",
        requestPath: "/udid/request-udid-manual/",
        wsUrl: "ws://127.0.0.1:8001/ws/auth/", //"wss://bt-auth.cabledelancer.com/ws/auth/",
        appType: "10foot",
        appVersion: "1.0",
        maxReconnectAttempts: 3,
        reconnectMs: [3000, 6000, 10000],
        heartbeatMs: 30000,
        privateKeyUrl: "/cableatlantico/keys/private_key.pem",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
      },
      socialLogin: {
        backendBaseUrl: 'http://backend.wind.do',
        google: {
          enabled: true,
          redirectUrl: '/wind/auth/google/',
          accessToken: '487078023200-686hite4p619jtaobfa4oksvhoal7qc1.apps.googleusercontent.com',
          // Mantener look del botón fallback aunque OAuth esté configurado.
          preferCustomButton: true,
          backendBaseUrl: '',
        },
        facebook: {
          enabled: true,
          redirectUrl: '/wind/auth/facebook/',
          accessToken: '823584907447149',
          backendBaseUrl: '',
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 200, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#2CE308",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: false,
      epgCardsChannelActiveBg: "#0A4385",
      epgCardsProgramLiveBg: "#6C8EB6",
      // Color de la barra de progreso (programa en vivo / "Ahora")
      epgCardsProgramLiveProgressBg: "#6C8EB6",
      epgCardsLaterGlobal: true,
      // Control del cierre de modal al reproducir en vivo:
      // true = siempre cierra, false = nunca cierra, omitido/auto = cierra solo en TV.
      epgCloseModalOnPlayLive: 'auto',
    },

    // Catchup: Legacy (grid) o Rails (carriles por canal). `catchup.ui.activeLayout`: 'rails' | 'legacy'
    // showAllLayouts: true muestra ambos para revisión.
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'rails',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        rails: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    // nativeAdaptersEnabled=false mantiene WebEngine incluso en TV (modo seguro).
    // enginePolicy: 'auto' | 'force-web' | 'force-lg' | 'force-samsung'
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
      hudAutoHideMs: 6000,
      // Inactividad (detener playback + screensaver):
      // - Timeout principal: clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC (getClientConfig).
      // - inactivityTestTimeoutSec: solo en DEV, override QA si clientConfig no trae valor.
      // - inactivityGraceSec: fallback si no hay X_INACTIVITY_GRACE_SEC en clientConfig.
      // - screensaverRotateMs: rotación de imágenes del screensaver.
      inactivityTestTimeoutSec: 0,
      inactivityGraceSec: 60,
      screensaverRotateMs: 9000,
      // Controles de reproducción (⏪ ⏯ ⏩) en Live/Services:
      // - false: solo mostrar en VOD/Catchup (default recomendado).
      // - true: también mostrarlos en 'service' (canales en vivo).
      showPlaybackButtonsOnLive: false,
      // Seekbar (timeline) en Live/Services:
      // - false: solo mostrar en VOD/Catchup (default recomendado).
      // - true: también mostrarla en 'service' (canales en vivo).
      showSeekbarOnLive: false,
      // Sidebar de canales (player): cerrar automáticamente al seleccionar (zapping).
      closeChannelSidebarOnSelect: false,
      // Cambio de canal en vivo con flechas ↑/↓ (mando remoto y teclado).
      channelChangeWithArrows: false,
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 8000, // Duración en milisegundos
      splashAnimado: true, // Si es true busca .gif o video (ver splashVideo), si es false busca .png/.webp/.jpg
      splashVideo: "splash.mp4",
      // Focus visible (PC + TV) - personalizable por marca
      focus: {
        enabled: true,
        // Color del foco (si no se define, cae al primaryColor)
        color: "#004c77",
        // Escala al enfocar (PC usa estilos base; TV aplica un boost adicional en CSS)
        scale: 1.05,
        // Anillos/sombra (CSS box-shadow). Usan var(--primary-color-rgb) con fallback.
        ring: '0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)',
        ring2: '0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)',
        shadow: '0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)',
      },
      // EPG
      epgLineColorTime: "#004c77",
      // Colores
      primaryColor: "#004c77", // Color principal de la marca (botones, acentos, etc.)
      secondaryColor: "#004c77", // Color secundario (hover, fondos, etc.)
      theme: "dark", // Tema global: "dark" o "light"
      // Fuente
      fontFamily: "Arial, sans-serif", // Familia de fuentes CSS (ej. "Arial, sans-serif", "Roboto, sans-serif")
      // Player loading overlay
      playerLoading: {
        premium: true,
      },
      // Sidebar Home
      sidebar: {
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        textColor: 'rgba(255, 255, 255, 0.82)',
        submenuBackgroundColor: 'rgba(0, 0, 0, 0.55)',
        submenuTextColor: 'rgba(255, 255, 255, 0.85)',
        fixed: true,
      },
    },

    // Configuración específica de bouquets
    bouquets: {
      // Color de la barra de progreso (timeship) en diseños event_and_logo, etc.
      timeshipColor: "#EE8834",
    },

    // Cabecera Inicio (tres columnas); banderas por área (contenido se define luego).
    header: {
      areas: {
        left: { enabled: true, showLogo: true, showTime: false, contentAlign: 'left' },
        center: { enabled: true, showLogo: false, showTime: false, contentAlign: 'center' },
        right: { enabled: true, showLogo: false, showTime: true, contentAlign: 'right' },
      },
      subheader: {
        enabled: true,
        areas: {
          left: { enabled: true, showServiceInfo: true, contentAlign: 'left' },
          center: { enabled: true, showServiceInfo: false, contentAlign: 'center' },
          right: { enabled: true, showServiceInfo: false, contentAlign: 'right' },
        },
      },
    },

    // Flags de HomeShell (header + ads por sección)
    homeShell: {
      header: {
        inicio: true,
        serviciosTvRadio: true,
        vod: true,
        catchup: true,
      },
      ads: {
        inicio: true,
        serviciosTvRadio: false,
        vod: false,
        catchup: false,
        topInBouquets: false,
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      profiles: false, // Si es true → redirige a /profile después del login, si es false → redirige a /smartcard después del login
      showRating: true, // Equivalente a showRating en 10foot
      osms: true, // Equivalente a osmsEnabled en 10foot
    },

    vod: {
      layout: "hero",
      add: true,
      vodDetail: {
        descriptionMaxLength: 180,
        showReleaseYear: true,
        showDuration: true,
        showParentalRating: true,
        showCategories: true,
        showStarRating: true,
        showDescription: true,
        playButtonColor: null,
        starRatingColor: null,
        heroGradientOpacity: 0.95,
        posterWidthMin: 100,
        posterWidthMax: 200,
        categoryTagBackground: "rgba(255, 255, 255, 0.12)",
        categoryTagBorderColor: "rgba(255, 255, 255, 0.2)",
        parentalBadgeBorderColor: "rgba(255, 255, 255, 0.5)",
        contentPosition: "bottom",
      },
    },
    // API: true = hashear contraseña en cliente (Panaccess); false = enviar en claro (ej. intv)
    hashPasswordBeforeLogin: true,
    debug: {
      spatialNav: false, // Logs en consola (default: solo en DEV)
      spatialNavVisual: false, // Debug visual (marcos rojos) (default: false)
    },
  },
  // inTV Play
  {
    brand: "intv",
    appName: "inTV Play",
    drm: "https://pmdw-1.in.tv.br/",
    token: '',
    os: 'HTML5',
    appVersion: '1',
    branding: 'Panaccess',
    developedBy: "inTV&#174,",
    version: "2.0.2",

    login: {
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)",// Fondo de la tarjeta del login
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Botón principal (Entrar)
        submitText: "#ffffff",// Texto del botón principal
        registerBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón de registro
        registerText: "#ffffff",// Texto del botón de registro
        udidBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón UDID
        udidText: "#ffffff",// Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)",// Fondo del botón de toggle
        toggleText: "rgba(255, 255, 255, 0.7)",// Texto del botón de toggle
        inputs: {
          // Inputs (usuario/contraseña) - personalizable por marca
          bg: "rgba(255, 255, 255, 0.1)",
          border: "rgba(255, 255, 255, 0.2)",
          text: "#ffffff",
          placeholder: "rgba(255, 255, 255, 0.4)",
          focusedBg: "rgba(255, 255, 255, 0.15)",
          focusedBorder: null,
          focusedShadow: null,
        },
        social: {
          // Botones login social (Google/Facebook)
          bg: "rgba(255, 255, 255, 0.08)",
          border: "rgba(255, 255, 255, 0.22)",
          text: "rgba(255, 255, 255, 0.92)",
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Fondo del botón cerrar modal
        modalCloseText: "#ffffff",// Texto del botón cerrar modal
      },
      backgroundImage: {
        // Personaliza el fondo del login por marca:
        // - assetPath: nombre de asset dentro de la carpeta de la marca (ej. "background.png", "login-bg.webp")
        enabled: false,
        assetPath: "backgroundalt.webp",
      },
      qrRegister: {
        enabled: false,
        url: "",
      },
      udid: {
        enabled: false,
        baseUrl: "",
        requestPath: "",
        wsUrl: "",
        appType: "10foot",
        appVersion: "1.0",
        maxReconnectAttempts: 3,
        reconnectMs: [3000, 6000, 10000],
        heartbeatMs: 30000,
        privateKeyUrl: "",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
      },
      socialLogin: {
        backendBaseUrl: 'http://127.0.0.1:8000',
        google: {
          enabled: false,
          redirectUrl: '',
          accessToken: '',
          preferCustomButton: true,
          backendBaseUrl: '',
        },
        facebook: {
          enabled: false,
          redirectUrl: '',
          accessToken: '',
          backendBaseUrl: '',
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)",
      epgCardsProgramLiveBg: "#6C8EB6",
      // Color de la barra de progreso (programa en vivo / "Ahora")
      epgCardsProgramLiveProgressBg: "#6C8EB6",
      epgCardsLaterGlobal: true,
      // Control del cierre de modal al reproducir en vivo:
      // true = siempre cierra, false = nunca cierra, omitido/auto = cierra solo en TV.
      epgCloseModalOnPlayLive: 'auto',
    },

    // Catchup: Legacy (grid) o Rails (carriles por canal).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'rails',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        rails: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
      // HUD: auto-ocultar controles tras X ms de inactividad (similar a EPG legacy).
      hudAutoHideMs: 6000,
      // Inactividad (detener playback + screensaver):
      // - Timeout principal: clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC (getClientConfig).
      // - inactivityTestTimeoutSec: solo en DEV, override QA si clientConfig no trae valor.
      // - inactivityGraceSec: fallback si no hay X_INACTIVITY_GRACE_SEC en clientConfig.
      // - screensaverRotateMs: rotación de imágenes del screensaver.
      inactivityTestTimeoutSec: 0,
      inactivityGraceSec: 60,
      screensaverRotateMs: 9000,
      showPlaybackButtonsOnLive: false,
      showSeekbarOnLive: false,
      closeChannelSidebarOnSelect: false,
      channelChangeWithArrows: true,
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif o video (ver splashVideo), si es false busca .png/.webp/.jpg
      // Focus visible (PC + TV) - personalizable por marca
      focus: {
        enabled: true,
        color: "#3355FF",
        scale: 1.05,
        ring: '0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)',
        ring2: '0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)',
        shadow: '0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)',
      },
      // EPG
      epgLineColorTime: "#3333FF",
      // Colores
      primaryColor: "#3355FF",
      secondaryColor: "#3355FF",
      theme: "light",
      // Fuente
      fontFamily: "Roboto, sans-serif",
      // Player loading overlay
      playerLoading: {
        premium: true,
      },
      // Sidebar Home (estructura uniforme entre marcas)
      sidebar: {
        backgroundColor: 'rgb(0, 4, 253)',
        textColor: 'rgba(255, 255, 255, 0.82)',
        submenuBackgroundColor: 'rgb(0, 0, 0)',
        submenuTextColor: 'rgba(255, 255, 255, 0.85)',
        fixed: true,
      },
    },

    // Configuración específica de bouquets
    bouquets: {
      timeshipColor: "#3333FF",
    },

    // Cabecera Inicio (tres columnas); banderas por área (contenido se define luego).
    header: {
      areas: {
        left: { 
          enabled: true, 
          showLogo: true, 
          showTime: false,
          contentAlign: 'left'
        },
        center: { 
          enabled: true, 
          showLogo: false, 
          showTime: false,
          contentAlign: 'center'
        },
        right: { 
          enabled: true, 
          showLogo: false, 
          showTime: true,
          contentAlign: 'right'
        },
      },
      subheader: {
        enabled: false,
        areas: {
          left: { 
            enabled: false, 
            showServiceInfo: true,
            contentAlign: 'left'
          },
          center: { 
            enabled: false, 
            showServiceInfo: false,
            contentAlign: 'right'
          },
          right: { 
            enabled: false, 
            showServiceInfo: false,
            contentAlign: 'right'
          },
        },
      },
    },

    // Flags de HomeShell (header + ads por sección)
    homeShell: {
      header: {
        inicio: true,
        serviciosTvRadio: true,
        vod: true,
        catchup: true,
      },
      ads: {
        inicio: true,
        serviciosTvRadio: false,
        vod: false,
        catchup: false,
        topInBouquets: false,
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      profiles: false,
      showRating: true, // Equivalente a showRating en 10foot
      osms: false, // Equivalente a osmsEnabled en 10foot
    },

    vod: {
      layout: "hero", // "hero" | "classic"
      add: true,
      vodDetail: {
        descriptionMaxLength: 180, // Caracteres máximos de la descripción antes de "Leer más" (0 = sin límite)
        showReleaseYear: true, // Mostrar año de estreno en la metadata
        showDuration: true, // Mostrar duración (min) en la metadata
        showParentalRating: true, // Mostrar badge de clasificación por edades
        showCategories: true, // Mostrar etiquetas de categorías
        showStarRating: true, // Mostrar valoración en estrellas
        showDescription: true, // Mostrar bloque de descripción
        playButtonColor: null, // Color del botón Reproducir (hex/css)
        starRatingColor: null, // Color de las estrellas rellenas (hex/css)
        heroGradientOpacity: 0.95, // Opacidad del gradiente inferior del hero (0–1)    
        posterWidthMin: 100, // Ancho mínimo del poster en px
        posterWidthMax: 200, // Ancho máximo del poster en px
        categoryTagBackground: "rgba(255, 255, 255, 0.12)", // Color/fondo de las etiquetas de categoría (css)
        categoryTagBorderColor: "rgba(255, 255, 255, 0.2)", // Borde de las etiquetas de categoría (css)
        parentalBadgeBorderColor: "rgba(255, 255, 255, 0.5)", // Borde del badge de clasificación por edades (css)
        contentPosition: "middle", // "top" | "middle" | "bottom" - posición vertical del bloque poster + info
      },
    },
    // API: true = hashear contraseña en cliente (Panaccess); false = enviar en claro (ej. intv)
    hashPasswordBeforeLogin: false,
    debug: {
      spatialNav: false, // Logs en consola (default: solo en DEV)
      spatialNavVisual: false, // Debug visual (marcos rojos) (default: false)
    },
  },
  // Gigmax
  {
    brand: "gigmax",
    appName: "Gigmax",
    drm: "https://cv10.panaccess.com/",
    token: '',
    os: 'HTML5',
    appVersion: '1',
    branding: 'Panaccess',
    developedBy: "Gigmax",
    version: "2.0.3",

    login: {
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)",// Fondo de la tarjeta del login
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Botón principal (Entrar)
        submitText: "#ffffff",// Texto del botón principal
        registerBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón de registro
        registerText: "#ffffff",// Texto del botón de registro
        udidBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón UDID
        udidText: "#ffffff",// Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)",// Fondo del botón de toggle
        toggleText: "rgba(255, 255, 255, 0.7)",// Texto del botón de toggle
        inputs: {
          // Inputs (usuario/contraseña) - personalizable por marca
          bg: "rgba(255, 255, 255, 0.1)",
          border: "rgba(255, 255, 255, 0.2)",
          text: "#ffffff",
          placeholder: "rgba(255, 255, 255, 0.4)",
          focusedBg: "rgba(255, 255, 255, 0.15)",
          focusedBorder: null,
          focusedShadow: null,
        },
        social: {
          // Botones login social (Google/Facebook)
          bg: "rgba(255, 255, 255, 0.08)",
          border: "rgba(255, 255, 255, 0.22)",
          text: "rgba(255, 255, 255, 0.92)",
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Fondo del botón cerrar modal
        modalCloseText: "#ffffff",// Texto del botón cerrar modal
      },
      backgroundImage: {
        // Personaliza el fondo del login por marca:
        // - assetPath: nombre de asset dentro de la carpeta de la marca (ej. "background.png", "login-bg.webp")
        enabled: false,
        assetPath: "backgroundalt.webp",
      },
      qrRegister: {
        enabled: false,
        url: "https://shop.fotelka.tv/?c=customer&p=register",
      },
      udid: {
        enabled: false,
        baseUrl: "",
        requestPath: "",
        wsUrl: "",
        appType: "10foot",
        appVersion: "1.0",
        maxReconnectAttempts: 3,
        reconnectMs: [3000, 6000, 10000],
        heartbeatMs: 30000,
        privateKeyUrl: "",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
      },
      socialLogin: {
        backendBaseUrl: 'http://127.0.0.1:8000',
        google: {
          enabled: false,
          redirectUrl: '/wind/auth/google/',
          accessToken: '803252352997-o8lj65s1h9ga2he9hu02vbflc4h749hv.apps.googleusercontent.com',
          preferCustomButton: true,
          backendBaseUrl: '',
        },
        facebook: {
          enabled: false,
          redirectUrl: '/wind/auth/facebook/',
          accessToken: '823584907447149',
          backendBaseUrl: '',
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#2CE308",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "#0A4385",
      epgCardsProgramLiveBg: "#6C8EB6",
      // Color de la barra de progreso (programa en vivo / "Ahora")
      epgCardsProgramLiveProgressBg: "#6C8EB6",
      epgCardsLaterGlobal: true,
      // Control del cierre de modal al reproducir en vivo:
      // true = siempre cierra, false = nunca cierra, omitido/auto = cierra solo en TV.
      epgCloseModalOnPlayLive: 'auto',
    },

    // Catchup: Legacy (grid) o Rails (carriles por canal).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'rails',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        rails: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
      hudAutoHideMs: 6000,
      // Inactividad (detener playback + screensaver):
      // - Timeout principal: clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC (getClientConfig).
      // - inactivityTestTimeoutSec: solo en DEV, override QA si clientConfig no trae valor.
      // - inactivityGraceSec: fallback si no hay X_INACTIVITY_GRACE_SEC en clientConfig.
      inactivityTestTimeoutSec: 0,
      inactivityGraceSec: 60,
      screensaverRotateMs: 9000,
      showPlaybackButtonsOnLive: false,
      showSeekbarOnLive: false,
      closeChannelSidebarOnSelect: false,
      channelChangeWithArrows: true,
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif o video (ver splashVideo), si es false busca .png/.webp/.jpg
      // Focus visible (PC + TV) - personalizable por marca
      focus: {
        enabled: true,
        color: "#FF6B35",
        scale: 1.05,
        ring: '0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)',
        ring2: '0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)',
        shadow: '0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)',
      },
      // EPG
      epgLineColorTime: "#2CE308",
      // Colores
      primaryColor: "#FF6B35",
      secondaryColor: "#cc5528",
      theme: "dark",
      // Fuente
      fontFamily: "Montserrat, sans-serif",
      // Player loading overlay
      playerLoading: {
        premium: true,
      },
      // Sidebar Home (estructura uniforme entre marcas)
      sidebar: {
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        textColor: 'rgba(255, 255, 255, 0.82)',
        submenuBackgroundColor: 'rgba(0, 0, 0, 0.55)',
        submenuTextColor: 'rgba(255, 255, 255, 0.85)',
        fixed: true,
      },
    },

    // Configuración específica de bouquets
    bouquets: {
      timeshipColor: "#2CE308",
    },

    // Cabecera Inicio (tres columnas); banderas por área (contenido se define luego).
    header: {
      areas: {
        left: { enabled: true, showLogo: true, showTime: false, contentAlign: 'left' },
        center: { enabled: true, showLogo: false, showTime: false, contentAlign: 'center' },
        right: { enabled: true, showLogo: false, showTime: true, contentAlign: 'right' },
      },
      subheader: {
        enabled: false,
        areas: {
          left: { enabled: true, showServiceInfo: false, contentAlign: 'left' },
          center: { enabled: true, showServiceInfo: true, contentAlign: 'center' },
          right: { enabled: true, showServiceInfo: false, contentAlign: 'right' },
        },
      },
    },

    // Flags de HomeShell (header + ads por sección)
    homeShell: {
      header: {
        inicio: true,
        serviciosTvRadio: true,
        vod: true,
        catchup: true,
      },
      ads: {
        inicio: true,
        serviciosTvRadio: false,
        vod: false,
        catchup: false,
        topInBouquets: false,
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      profiles: false,
      showRating: false, // Equivalente a showRating en 10foot
      osms: false, // Equivalente a osmsEnabled en 10foot
    },

    vod: {
      layout: "hero",
      add: true,
      vodDetail: {
        descriptionMaxLength: 180,
        showReleaseYear: true,
        showDuration: true,
        showParentalRating: true,
        showCategories: true,
        showStarRating: true,
        showDescription: true,
        playButtonColor: null,
        starRatingColor: null,
        heroGradientOpacity: 0.95,
        posterWidthMin: 100,
        posterWidthMax: 200,
        categoryTagBackground: "rgba(255, 255, 255, 0.12)",
        categoryTagBorderColor: "rgba(255, 255, 255, 0.2)",
        parentalBadgeBorderColor: "rgba(255, 255, 255, 0.5)",
        contentPosition: "bottom",
      },
    },
    hashPasswordBeforeLogin: true,
    debug: {
      spatialNav: false,
      spatialNavVisual: false,
    },
  },
  // Cableatlantico
  {
    brand: "cableatlantico",
    appName: "delancertv",
    drm: 'https://mw.cabledelancer.com/', //"https://cv01.panaccess.com/"
    token: '',
    os: 'HTML5',
    appVersion: '1',
    branding: 'Cabledelancer',
    developedBy: "Cabledelancer",
    version: "1.0.2",

    login: {
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)",
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",
        submitText: "#ffffff",
        registerBg: "rgba(255, 255, 255, 0.12)",
        registerText: "#ffffff",
        udidBg: "rgba(255, 255, 255, 0.12)",
        udidText: "#ffffff",
        toggleBg: "rgba(255, 255, 255, 0.1)",
        toggleText: "rgba(255, 255, 255, 0.7)",
        inputs: {
          bg: "rgba(255, 255, 255, 0.1)",
          border: "rgba(255, 255, 255, 0.2)",
          text: "#ffffff",
          placeholder: "rgba(255, 255, 255, 0.4)",
          focusedBg: "rgba(255, 255, 255, 0.15)",
          focusedBorder: null,
          focusedShadow: null,
        },
        social: {
          bg: "rgba(255, 255, 255, 0.08)",
          border: "rgba(255, 255, 255, 0.22)",
          text: "rgba(255, 255, 255, 0.92)",
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",
        modalCloseText: "#ffffff",
      },
      backgroundImage: {
        enabled: false,
        assetPath: "backgroundalt.webp",
      },
      qrRegister: {
        enabled: false,
        url: "https://shop.fotelka.tv/?c=customer&p=register",
      },
      udid: {
        enabled: true,
        baseUrl: "http://127.0.0.1:8000", //"https://bt-auth.cabledelancer.com",
        requestPath: "/udid/request-udid-manual/",
        wsUrl: "ws://127.0.0.1:8000/ws/auth/", //"wss://bt-auth.cabledelancer.com/ws/auth/",
        appType: "10foot",
        appVersion: "1.0",
        maxReconnectAttempts: 3,
        reconnectMs: [3000, 6000, 10000],
        heartbeatMs: 30000,
        privateKeyUrl: "/cableatlantico/keys/private_key.pem",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
      },
      socialLogin: {
        backendBaseUrl: '',
        google: {
          enabled: false,
          redirectUrl: '',
          accessToken: '',
          preferCustomButton: true,
          backendBaseUrl: '',
        },
        facebook: {
          enabled: false,
          redirectUrl: '',
          accessToken: '',
          backendBaseUrl: '',
        },
      },
    },    

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 3, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)", // Color de fondo del canal activo
      epgCardsProgramLiveBg: "#6C8EB6",
      // Color de la barra de progreso (programa en vivo / "Ahora")
      epgCardsProgramLiveProgressBg: "#6C8EB6",
      epgCardsLaterGlobal: true, // Mostrar programas pasados en la guía
      epgCloseModalOnPlayLive: 'auto', // Control del cierre de modal al reproducir en vivo: true = siempre cierra, false = nunca cierra, omitido/auto = cierra solo en TV.
    },

    // Catchup: Legacy (grid) o Rails (carriles por canal).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'rails',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        rails: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
      hudAutoHideMs: 6000,
      // Inactividad (detener playback + screensaver):
      // - Timeout principal: clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC (getClientConfig).
      // - inactivityTestTimeoutSec: solo en DEV, override QA si clientConfig no trae valor.
      // - inactivityGraceSec: fallback si no hay X_INACTIVITY_GRACE_SEC en clientConfig.
      inactivityTestTimeoutSec: 0,
      inactivityGraceSec: 60,
      screensaverRotateMs: 9000,
      showPlaybackButtonsOnLive: false,
      showSeekbarOnLive: false,
      closeChannelSidebarOnSelect: false,
      channelChangeWithArrows: true,
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif o video (ver splashVideo), si es false busca .png/.webp/.jpg
      // Focus visible (PC + TV) - personalizable por marca
      focus: {
        enabled: true,
        color: "#3333FF",
        scale: 1.05,
        ring: '0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)',
        ring2: '0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)',
        shadow: '0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)',
      },
      // EPG
      epgLineColorTime: "#3333FF",
      // Colores
      primaryColor: "#3333FF",
      secondaryColor: "#1a1aaa",
      theme: "light",
      // Fuente
      fontFamily: "Roboto, sans-serif",
      // Player loading overlay
      playerLoading: {
        premium: true,
      },
      // Sidebar Home (estructura uniforme entre marcas)
      sidebar: {
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        textColor: 'rgba(255, 255, 255, 0.82)',
        submenuBackgroundColor: 'rgba(0, 0, 0, 0.55)',
        submenuTextColor: 'rgba(255, 255, 255, 0.85)',
        fixed: true,
      },
    },

    // Configuración específica de bouquets
    bouquets: {
      timeshipColor: "#3333FF",
    },

    // Cabecera Inicio (tres columnas); banderas por área (contenido se define luego).
    header: {
      areas: {
        left: { enabled: true, showLogo: true, showTime: false, contentAlign: 'left' },
        center: { enabled: true, showLogo: false, showTime: false, contentAlign: 'center' },
        right: { enabled: true, showLogo: false, showTime: true, contentAlign: 'right' },
      },
      subheader: {
        enabled: true,
        areas: {
          left: { enabled: true, showServiceInfo: true, contentAlign: 'left' },
          center: { enabled: true, showServiceInfo: false, contentAlign: 'center' },
          right: { enabled: true, showServiceInfo: false, contentAlign: 'right' },
        },
      },
    },

    // Flags de HomeShell (header + ads por sección)
    homeShell: {
      header: {
        inicio: true,
        serviciosTvRadio: true,
        vod: true,
        catchup: true,
      },
      ads: {
        inicio: true,
        serviciosTvRadio: false,
        vod: false,
        catchup: false,
        topInBouquets: false,
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      profiles: false,
      showRating: true, // Equivalente a showRating en 10foot
      osms: true, // Equivalente a osmsEnabled en 10foot
    },

    vod: {
      layout: "hero", // "hero" | "classic"
      add: true,
      vodDetail: {
        descriptionMaxLength: 180, // Caracteres máximos de la descripción antes de "Leer más" (0 = sin límite)
        showReleaseYear: true, // Mostrar año de estreno en la metadata
        showDuration: true, // Mostrar duración (min) en la metadata
        showParentalRating: true, // Mostrar badge de clasificación por edades
        showCategories: true, // Mostrar etiquetas de categorías
        showStarRating: true, // Mostrar valoración en estrellas
        showDescription: true, // Mostrar bloque de descripción
        playButtonColor: null, // Color del botón Reproducir (hex/css)
        starRatingColor: null, // Color de las estrellas rellenas (hex/css)
        heroGradientOpacity: 0.95, // Opacidad del gradiente inferior del hero (0–1)    
        posterWidthMin: 100, // Ancho mínimo del poster en px
        posterWidthMax: 200, // Ancho máximo del poster en px
        categoryTagBackground: "rgba(255, 255, 255, 0.12)", // Color/fondo de las etiquetas de categoría (css)
        categoryTagBorderColor: "rgba(255, 255, 255, 0.2)", // Borde de las etiquetas de categoría (css)
        parentalBadgeBorderColor: "rgba(255, 255, 255, 0.5)", // Borde del badge de clasificación por edades (css)
        contentPosition: "middle", // "top" | "middle" | "bottom" - posición vertical del bloque poster + info
      },
    },
    // API: true = hashear contraseña en cliente (Panaccess); false = enviar en claro (ej. intv)
    hashPasswordBeforeLogin: false,
    debug: {
      spatialNav: false, // Logs en consola (default: solo en DEV)
      spatialNavVisual: false, // Debug visual (marcos rojos) (default: false)
    },
  },
  // Windplay
  {
    brand: "wind",
    appName: "WindTV",
    drm: "https://middleware.wind.do/",//drm: "https://cv01.panaccess.com/",
    token: '',
    os: 'HTML5',
    appVersion: '1',    
    branding: 'Panaccess',
    developedBy: "windplay",
    version: "1.0.0",

    login: {
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)",// Fondo de la tarjeta del login
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Botón principal (Entrar)
        submitText: "#ffffff",// Texto del botón principal
        registerBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón de registro
        registerText: "#ffffff",// Texto del botón de registro
        udidBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón UDID
        udidText: "#ffffff",// Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)",// Fondo del botón de toggle
        toggleText: "rgba(255, 255, 255, 0.7)",// Texto del botón de toggle
        inputs: {
          // Inputs (usuario/contraseña) - personalizable por marca
          bg: "rgba(255, 255, 255, 0.1)",
          border: "rgba(255, 255, 255, 0.2)",
          text: "#ffffff",
          placeholder: "rgba(255, 255, 255, 0.4)",
          focusedBg: "rgba(255, 255, 255, 0.15)",
          focusedBorder: null,
          focusedShadow: null,
        },
        social: {
          // Botones login social (Google/Facebook)
          bg: "rgba(255, 255, 255, 0.08)",
          border: "rgba(255, 255, 255, 0.22)",
          text: "rgba(255, 255, 255, 0.92)",
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Fondo del botón cerrar modal
        modalCloseText: "#ffffff",// Texto del botón cerrar modal
      },
      backgroundImage: {
        // Personaliza el fondo del login por marca:
        // - assetPath: nombre de asset dentro de la carpeta de la marca (ej. "background.png", "login-bg.webp")
        enabled: true,
        assetPath: "backgroundalt.webp",
      },
      qrRegister: {
        enabled: true,
        url: "https://backend.wind.do/wind/register/",
      },
      udid: {
        enabled: false,
        baseUrl: "",
        requestPath: "",
        wsUrl: "",
        appType: "10foot",
        appVersion: "1.0",
        maxReconnectAttempts: 3,
        reconnectMs: [3000, 6000, 10000],
        heartbeatMs: 30000,
        privateKeyUrl: "",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
      },
      socialLogin: {
        backendBaseUrl: 'https://backend.wind.do',
        google: {
          enabled: true,
          redirectUrl: '/wind/auth/google/',
          accessToken: '487078023200-686hite4p619jtaobfa4oksvhoal7qc1.apps.googleusercontent.com',
          preferCustomButton: true,
          backendBaseUrl: '',
        },
        facebook: {
          enabled: true,
          redirectUrl: '/wind/auth/facebook/',
          accessToken: '823584907447149',
          backendBaseUrl: '',
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
      epgPast: false,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)",
      epgCardsProgramLiveBg: "#6C8EB6",
      epgCardsProgramLiveProgressBg: "#6C8EB6",// Color de la barra de progreso (programa en vivo / "Ahora")
      epgCardsLaterGlobal: true,
      // Control del cierre de modal al reproducir en vivo:
      // true = siempre cierra, false = nunca cierra, omitido/auto = cierra solo en TV.
      epgCloseModalOnPlayLive: 'auto',
    },

    // Catchup: Legacy (grid) o Rails (carriles por canal).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'rails',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        rails: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
      hudAutoHideMs: 6000,
      // Inactividad (detener playback + screensaver):
      // - Timeout principal: clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC (getClientConfig).
      // - inactivityTestTimeoutSec: solo en DEV, override QA si clientConfig no trae valor.
      // - inactivityGraceSec: fallback si no hay X_INACTIVITY_GRACE_SEC en clientConfig.
      inactivityTestTimeoutSec: 0,
      inactivityGraceSec: 60,
      screensaverRotateMs: 9000,
      showPlaybackButtonsOnLive: false,
      showSeekbarOnLive: false,
      closeChannelSidebarOnSelect: false,
      channelChangeWithArrows: true,
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 5000, // Duración en milisegundos
      splashAnimado: true, // Si es true busca .gif o video (ver splashVideo), si es false busca .png/.webp/.jpg
      splashVideo: "splash.mp4",
      // Focus visible (PC + TV) - personalizable por marca
      focus: {
        enabled: true,
        color: "#3AA3AE",
        scale: 1.05,
        ring: '0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)',
        ring2: '0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)',
        shadow: '0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)',
      },
      // EPG
      epgLineColorTime: "#3333FF",
      // Colores
      primaryColor: "#3AA3AE",
      secondaryColor: "#2C7F88",
      theme: "dark",
      // Fuente
      fontFamily: "Roboto, sans-serif",
      // Player loading overlay
      playerLoading: {
        premium: true,
      },
      // Sidebar Home (estructura uniforme entre marcas)
      sidebar: {
        backgroundColor: '#012B4F',
        textColor: 'rgba(255, 255, 255, 0.82)',
        submenuBackgroundColor: 'rgb(0, 0, 0)',
        submenuTextColor: 'rgba(255, 255, 255, 0.85)',
        fixed: true,
      },
    },

    // Configuración específica de bouquets
    bouquets: {
      timeshipColor: "#3333FF",
    },

    // Cabecera Inicio (tres columnas); banderas por área (contenido se define luego).
    header: {
      areas: {
        left: { 
          enabled: true, 
          showLogo: true, 
          showTime: false,
          contentAlign: 'left'
        },
        center: { 
          enabled: true, 
          showLogo: false, 
          showTime: false,
          contentAlign: 'center'
        },
        right: { 
          enabled: true, 
          showLogo: false, 
          showTime: true,
          contentAlign: 'right'
        },
      },
      subheader: {
        enabled: false,
        areas: {
          left: { 
            enabled: true, 
            showServiceInfo: true,
            contentAlign: 'left'
          },
          center: { 
            enabled: true, 
            showServiceInfo: false,
            contentAlign: 'right'
          },
          right: { 
            enabled: true, 
            showServiceInfo: false,
            contentAlign: 'right'
          },
        },
      },
    },

    // Flags de HomeShell (header + ads por sección)
    homeShell: {
      header: {
        inicio: true,
        serviciosTvRadio: true,
        vod: true,
        catchup: true,
      },
      ads: {
        inicio: true,
        serviciosTvRadio: false,
        vod: false,
        catchup: false,
        topInBouquets: false,
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      profiles: false,
      showRating: true, // Equivalente a showRating en 10foot
      osms: true, // Equivalente a osmsEnabled en 10foot
    },

    vod: {
      layout: "hero", // "hero" | "classic"
      add: true,
      vodDetail: {
        descriptionMaxLength: 180, // Caracteres máximos de la descripción antes de "Leer más" (0 = sin límite)
        showReleaseYear: true, // Mostrar año de estreno en la metadata
        showDuration: true, // Mostrar duración (min) en la metadata
        showParentalRating: true, // Mostrar badge de clasificación por edades
        showCategories: true, // Mostrar etiquetas de categorías
        showStarRating: true, // Mostrar valoración en estrellas
        showDescription: true, // Mostrar bloque de descripción
        playButtonColor: null, // Color del botón Reproducir (hex/css)
        starRatingColor: null, // Color de las estrellas rellenas (hex/css)
        heroGradientOpacity: 0.95, // Opacidad del gradiente inferior del hero (0–1)    
        posterWidthMin: 100, // Ancho mínimo del poster en px
        posterWidthMax: 200, // Ancho máximo del poster en px
        categoryTagBackground: "rgba(255, 255, 255, 0.12)", // Color/fondo de las etiquetas de categoría (css)
        categoryTagBorderColor: "rgba(255, 255, 255, 0.2)", // Borde de las etiquetas de categoría (css)
        parentalBadgeBorderColor: "rgba(255, 255, 255, 0.5)", // Borde del badge de clasificación por edades (css)
        contentPosition: "middle", // "top" | "middle" | "bottom" - posición vertical del bloque poster + info
      },
    },
    // API: true = hashear contraseña en cliente (Panaccess); false = enviar en claro (ej. intv)
    hashPasswordBeforeLogin: false,
    debug: {
      spatialNav: false, // Logs en consola (default: solo en DEV)
      spatialNavVisual: false, // Debug visual (marcos rojos) (default: false)
    },
  },
  // MultiplusTV
  {
    brand: "multiplustv",
    appName: "MultiplusTV",
    drm: "https://cv10.panaccess.com/",
    token: '',
    os: 'HTML5',
    appVersion: '1',    
    branding: 'Panaccess',
    developedBy: "MultiplusTV",
    version: "1.0.0",

    login: {
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)",// Fondo de la tarjeta del login
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Botón principal (Entrar)
        submitText: "#ffffff",// Texto del botón principal
        registerBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón de registro
        registerText: "#ffffff",// Texto del botón de registro
        udidBg: "rgba(255, 255, 255, 0.12)",// Fondo del botón UDID
        udidText: "#ffffff",// Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)",// Fondo del botón de toggle
        toggleText: "rgba(255, 255, 255, 0.7)",// Texto del botón de toggle
        inputs: {
          // Inputs (usuario/contraseña) - personalizable por marca
          bg: "rgba(255, 255, 255, 0.1)",
          border: "rgba(255, 255, 255, 0.2)",
          text: "#ffffff",
          placeholder: "rgba(255, 255, 255, 0.4)",
          focusedBg: "rgba(255, 255, 255, 0.15)",
          focusedBorder: null,
          focusedShadow: null,
        },
        social: {
          // Botones login social (Google/Facebook)
          bg: "rgba(255, 255, 255, 0.08)",
          border: "rgba(255, 255, 255, 0.22)",
          text: "rgba(255, 255, 255, 0.92)",
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",// Fondo del botón cerrar modal
        modalCloseText: "#ffffff",// Texto del botón cerrar modal
      },
      backgroundImage: {
        // Personaliza el fondo del login por marca:
        // - assetPath: nombre de asset dentro de la carpeta de la marca (ej. "background.png", "login-bg.webp")
        enabled: false,
        assetPath: "backgroundalt.webp",
      },
      qrRegister: {
        enabled: false,
        url: "https://shop.fotelka.tv/?c=customer&p=register",
      },
      udid: {
        enabled: true,
        baseUrl: "",
        requestPath: "",
        wsUrl: "",
        appType: "10foot",
        appVersion: "1.0",
        maxReconnectAttempts: 3,
        reconnectMs: [3000, 6000, 10000],
        heartbeatMs: 30000,
        privateKeyUrl: "",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
      },
      socialLogin: {
        backendBaseUrl: 'http://127.0.0.1:8000/',
        google: {
          enabled: true,
          redirectUrl: '/wind/auth/google/',
          accessToken: '803252352997-o8lj65s1h9ga2he9hu02vbflc4h749hv.apps.googleusercontent.com',
          preferCustomButton: true,
          backendBaseUrl: '',
        },
        facebook: {
          enabled: true,
          redirectUrl: '',
          accessToken: '',
          backendBaseUrl: '',
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
      epgPast: false,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)",
      epgCardsProgramLiveBg: "#6C8EB6",
      epgCardsProgramLiveProgressBg: "#6C8EB6",// Color de la barra de progreso (programa en vivo / "Ahora")
      epgCardsLaterGlobal: true,
      // Control del cierre de modal al reproducir en vivo:
      // true = siempre cierra, false = nunca cierra, omitido/auto = cierra solo en TV.
      epgCloseModalOnPlayLive: 'auto',
    },

    // Catchup: Legacy (grid) o Rails (carriles por canal).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'rails',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        rails: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
      hudAutoHideMs: 6000,
      // Inactividad (detener playback + screensaver):
      // - Timeout principal: clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC (getClientConfig).
      // - inactivityTestTimeoutSec: solo en DEV, override QA si clientConfig no trae valor.
      // - inactivityGraceSec: fallback si no hay X_INACTIVITY_GRACE_SEC en clientConfig.
      inactivityTestTimeoutSec: 0,
      inactivityGraceSec: 60,
      screensaverRotateMs: 9000,
      showPlaybackButtonsOnLive: false,
      showSeekbarOnLive: false,
      closeChannelSidebarOnSelect: false,
      channelChangeWithArrows: true,
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif o video (ver splashVideo), si es false busca .png/.webp/.jpg
      // Focus visible (PC + TV) - personalizable por marca
      focus: {
        enabled: true,
        color: "#3AA3AE",
        scale: 1.05,
        ring: '0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)',
        ring2: '0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)',
        shadow: '0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)',
      },
      // EPG
      epgLineColorTime: "#3333FF",
      // Colores
      primaryColor: "#3AA3AE",
      secondaryColor: "#2C7F88",
      theme: "dark",
      // Fuente
      fontFamily: "Roboto, sans-serif",
      // Player loading overlay
      playerLoading: {
        premium: true,
      },
      // Sidebar Home (estructura uniforme entre marcas)
      sidebar: {
        backgroundColor: '#012B4F',
        textColor: 'rgba(255, 255, 255, 0.82)',
        submenuBackgroundColor: 'rgb(0, 0, 0)',
        submenuTextColor: 'rgba(255, 255, 255, 0.85)',
        fixed: true,
      },
    },

    // Configuración específica de bouquets
    bouquets: {
      timeshipColor: "#3333FF",
    },

    // Cabecera Inicio (tres columnas); banderas por área (contenido se define luego).
    header: {
      areas: {
        left: { 
          enabled: true, 
          showLogo: true, 
          showTime: false,
          contentAlign: 'left'
        },
        center: { 
          enabled: true, 
          showLogo: false, 
          showTime: false,
          contentAlign: 'center'
        },
        right: { 
          enabled: true, 
          showLogo: false, 
          showTime: true,
          contentAlign: 'right'
        },
      },
      subheader: {
        enabled: true,
        areas: {
          left: { 
            enabled: true, 
            showServiceInfo: true,
            contentAlign: 'left'
          },
          center: { 
            enabled: true, 
            showServiceInfo: false,
            contentAlign: 'right'
          },
          right: { 
            enabled: true, 
            showServiceInfo: false,
            contentAlign: 'right'
          },
        },
      },
    },

    // Flags de HomeShell (header + ads por sección)
    homeShell: {
      header: {
        inicio: true,
        serviciosTvRadio: true,
        vod: true,
        catchup: true,
      },
      ads: {
        inicio: true,
        serviciosTvRadio: false,
        vod: false,
        catchup: false,
        topInBouquets: false,
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      profiles: false,
      showRating: true, // Equivalente a showRating en 10foot
      osms: false, // Equivalente a osmsEnabled en 10foot
    },

    vod: {
      layout: "hero", // "hero" | "classic"
      add: true,
      vodDetail: {
        descriptionMaxLength: 180, // Caracteres máximos de la descripción antes de "Leer más" (0 = sin límite)
        showReleaseYear: true, // Mostrar año de estreno en la metadata
        showDuration: true, // Mostrar duración (min) en la metadata
        showParentalRating: true, // Mostrar badge de clasificación por edades
        showCategories: true, // Mostrar etiquetas de categorías
        showStarRating: true, // Mostrar valoración en estrellas
        showDescription: true, // Mostrar bloque de descripción
        playButtonColor: null, // Color del botón Reproducir (hex/css)
        starRatingColor: null, // Color de las estrellas rellenas (hex/css)
        heroGradientOpacity: 0.95, // Opacidad del gradiente inferior del hero (0–1)    
        posterWidthMin: 100, // Ancho mínimo del poster en px
        posterWidthMax: 200, // Ancho máximo del poster en px
        categoryTagBackground: "rgba(255, 255, 255, 0.12)", // Color/fondo de las etiquetas de categoría (css)
        categoryTagBorderColor: "rgba(255, 255, 255, 0.2)", // Borde de las etiquetas de categoría (css)
        parentalBadgeBorderColor: "rgba(255, 255, 255, 0.5)", // Borde del badge de clasificación por edades (css)
        contentPosition: "middle", // "top" | "middle" | "bottom" - posición vertical del bloque poster + info
      },
    },
    // API: true = hashear contraseña en cliente (Panaccess); false = enviar en claro (ej. intv)
    hashPasswordBeforeLogin: false,
    debug: {
      spatialNav: false, // Logs en consola (default: solo en DEV)
      spatialNavVisual: false, // Debug visual (marcos rojos) (default: false)
    },
  },
];

/**
 * Obtiene la configuración de una marca por su identificador.
 * @param {string} brandName - Identificador de la marca (ej. "bromteck", "intv", "gigmax").
 * @returns {Object|null} Objeto de configuración de la marca o null si no existe.
 */
export function getBrandConfig(brandName) {
  const brand = BRANDS.find((b) => b.brand === brandName);
  if (!brand) return null;

  const resolved = applyBrandRuntimePolicy(brand);
  if (!resolved.token && import.meta.env?.PROD) {
    console.warn(
      `[brands] Token no configurado para "${brand.brand}". ` +
        `Define VITE_BRAND_TOKEN_${String(brand.brand).toUpperCase()} en .env.local`,
    );
  }

  return resolved;
}

