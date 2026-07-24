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
 *   @param {Object} [ui.search] - Tema de la pantalla Buscador (/home/buscador). Opcional; sin definir usa defaults en CSS.
 *     @param {string} [ui.search.overlayBg] - Fondo del overlay detrás del panel.
 *     @param {string} [ui.search.panelBg] - Fondo del panel principal.
 *     @param {Object} [ui.search.header] - Barra superior (input + limpiar).
 *       @param {string} [ui.search.header.bg] - Fondo de la barra.
 *       @param {string} [ui.search.header.text] - Color de texto en la barra.
 *     @param {Object} [ui.search.input] - Campo de búsqueda.
 *       @param {string} [ui.search.input.bg] - Fondo del input.
 *       @param {string} [ui.search.input.text] - Color del texto.
 *       @param {string} [ui.search.input.placeholder] - Color del placeholder.
 *       @param {string} [ui.search.input.focusedBg] - Fondo al enfocar.
 *       @param {string} [ui.search.input.focusedBorder] - Borde al enfocar (default: --focus-color).
 *       @param {string} [ui.search.input.focusedShadow] - Sombra/box-shadow al enfocar.
 *     @param {Object} [ui.search.clearButton] - Botón limpiar.
 *       @param {string} [ui.search.clearButton.bg] - Fondo.
 *       @param {string} [ui.search.clearButton.text] - Texto.
 *       @param {string} [ui.search.clearButton.hoverBg] - Fondo en hover/foco.
 *     @param {Object} [ui.search.tabs] - Pestañas de filtro (Todos, TV, VOD…).
 *       @param {string} [ui.search.tabs.bg] - Fondo inactivo.
 *       @param {string} [ui.search.tabs.text] - Texto inactivo.
 *       @param {string} [ui.search.tabs.hoverBg] - Fondo hover/foco inactivo.
 *       @param {string} [ui.search.tabs.activeBg] - Fondo activo (default: --primary-color).
 *       @param {string} [ui.search.tabs.activeText] - Texto activo.
 *       @param {string} [ui.search.tabs.activeHoverBg] - Fondo activo en hover/foco.
 *     @param {Object} [ui.search.results] - Área y tarjetas de resultados.
 *       @param {string} [ui.search.results.areaBg] - Fondo del contenedor scroll.
 *       @param {string} [ui.search.results.cardBg] - Fondo de cada tarjeta.
 *       @param {string} [ui.search.results.cardBorder] - Borde de tarjeta.
 *       @param {string} [ui.search.results.cardHoverBg] - Fondo tarjeta hover/foco.
 *       @param {string} [ui.search.results.cardFocusBorder] - Borde tarjeta hover/foco (default: --focus-color).
 *       @param {string} [ui.search.results.titleText] - Títulos y nombres.
 *       @param {string} [ui.search.results.metaText] - Metadatos secundarios (hora, actor, etc.).
 *       @param {string} [ui.search.results.sectionTitleBg] - Fondo del título de sección (tab Todos).
 *       @param {string} [ui.search.results.thumbBg] - Fondo de miniatura/placeholder.
 *     @param {Object} [ui.search.empty] - Estados vacíos y contador.
 *       @param {string} [ui.search.empty.text] - Mensaje sin resultados.
 *       @param {string} [ui.search.empty.countText] - Texto del contador de resultados.
 *
 * @param {Object} features - Funcionalidades activas o no para esta marca:
 *   @param {boolean} features.profiles - true: tras login redirige a /profile; false: redirige a /smartcard.
 *   @param {boolean} features.showRating - true: muestra la clasificación/rating de contenido; false: la oculta.
 *   @param {boolean} features.osms - true: habilita la integración OSMS y su menú; false: la deshabilita.
 *
 * @param {Object} login - Bloque unificado de configuración del Login por marca.
 *   @param {Object} login.theme - Colores y estilos del formulario (CSS: hex, rgba, gradiente o var(--primary-color)).
 *     @param {string} login.theme.cardBackground - Fondo de la tarjeta central del formulario.
 *     @param {string} login.theme.submitBg - Fondo del botón principal "Entrar".
 *     @param {string} login.theme.submitText - Color del texto del botón "Entrar".
 *     @param {string} login.theme.registerBg - Fondo del botón "Registrarse" (QR).
 *     @param {string} login.theme.registerText - Color del texto del botón "Registrarse".
 *     @param {string} login.theme.udidBg - Fondo del botón "Login UDID".
 *     @param {string} login.theme.udidText - Color del texto del botón UDID.
 *     @param {string} login.theme.toggleBg - Fondo del botón mostrar/ocultar contraseña.
 *     @param {string} login.theme.toggleText - Color del texto del toggle de contraseña.
 *     @param {Object} login.theme.inputs - Campos usuario/contraseña.
 *       @param {string} login.theme.inputs.bg - Fondo de los campos.
 *       @param {string} login.theme.inputs.border - Borde de los campos.
 *       @param {string} login.theme.inputs.text - Color del texto escrito.
 *       @param {string} login.theme.inputs.placeholder - Color del placeholder (--login-input-placeholder).
 *       @param {string|null} login.theme.inputs.focusedBg - Fondo con foco (TV/teclado).
 *       @param {string|null} login.theme.inputs.focusedBorder - Borde con foco; null = ui.primaryColor.
 *       @param {string|null} login.theme.inputs.focusedShadow - Sombra con foco; null = anillo primaryColor.
 *     @param {Object} login.theme.social - Botones Google/Facebook (fallback custom).
 *       @param {string} login.theme.social.bg - Fondo de botones sociales.
 *       @param {string} login.theme.social.border - Borde de botones sociales.
 *       @param {string} login.theme.social.text - Texto de botones sociales.
 *     @param {string} login.theme.modalCloseBg - Fondo del botón cerrar modal QR/UDID.
 *     @param {string} login.theme.modalCloseText - Texto del botón cerrar modal.
 *     @param {string|null} login.theme.linkColor - Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor.
 *     @param {string} login.theme.dividerColor - Color línea del separador "o" antes de login social.
 *   @param {Object} login.backgroundImage - Imagen de fondo de pantalla completa.
 *     @param {boolean} login.backgroundImage.enabled - true: usa assetPath; false: assets.background o background.png.
 *     @param {string} login.backgroundImage.assetPath - Archivo en la carpeta de assets de la marca.
 *   @param {Object} login.qrRegister - Registro por QR en Login:
 *     @param {boolean} login.qrRegister.enabled - Habilita/deshabilita el botón/modal de registro QR.
 *     @param {string} login.qrRegister.url - URL destino codificada en el QR.
 *   @param {Object} login.forgotPassword - Enlace "Olvidé contraseña":
 *     @param {boolean} login.forgotPassword.enabled - Muestra enlace debajo del campo contraseña.
 *     @param {string} login.forgotPassword.url - URL destino al hacer clic; vacío = no navega.
 *   @param {Object} login.udid - Login por UDID:
 *     @param {boolean} login.udid.enabled - Habilita/deshabilita el login externo por UDID.
 *     @param {string} login.udid.baseUrl - Base HTTP del backend UDID.
 *     @param {string} login.udid.requestPath - Path POST para solicitar código UDID (recomendado: /udid/request-udid-manual/).
 *     @param {string} login.udid.wsUrl - WebSocket para recibir credenciales cifradas.
 *     @param {string} login.udid.appType - Tipo de app enviado al backend (ej. "10foot", "web").
 *     @param {string} login.udid.appVersion - Versión enviada al backend.
 *     @param {number} login.udid.maxReconnectAttempts - Reintentos máximos de reconexión WebSocket.
 *     @param {number[]} login.udid.reconnectMs - Delays entre reintentos (ms).
 *     @param {number} login.udid.heartbeatMs - Intervalo de ping WebSocket (ms).
 *     @param {string} login.udid.privateKeyUrl - Ruta pública PEM para descifrar encrypted_credentials; vacío = deshabilitado.
 *   @param {Object} login.socialLogin - Login social (Google / Facebook) por marca:
 *     @param {string} login.socialLogin.backendBaseUrl - Base común del backend; alternativa: VITE_SOCIAL_AUTH_BASE_URL.
 *     @param {Object} login.socialLogin.google - Google Identity + POST OAuth.
 *       @param {boolean} login.socialLogin.google.enabled - Muestra el botón (solo escritorio; en TV se oculta).
 *       @param {string} login.socialLogin.google.redirectUrl - URL absoluta del POST o path relativo a la base.
 *       @param {string} login.socialLogin.google.accessToken - Google OAuth client_id; alternativa: VITE_GOOGLE_CLIENT_ID.
 *       @param {boolean} login.socialLogin.google.preferCustomButton - true: botón custom con theme.social; false: widget GIS nativo.
 *       @param {string} login.socialLogin.google.backendBaseUrl - Base solo para Google; vacío = socialLogin.backendBaseUrl.
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
 *   @param {number} EPG.hoursLimit
 *   @param {string} EPG.epgLineColorTime - Color guía (alineado con ui.epgLineColorTime de la marca).
 *   @param {number} EPG.reminderLeadSeconds - Segundos antes de start para popup de recordatorio. Default: 60.
 *   @param {boolean} EPG.reminderShowWhilePlaying - Si true, el popup puede mostrarse con playback activo.
 *   @param {boolean} EPG.epgPast
 *   @param {boolean} EPG.epgPagesPastEnabled
 *   @param {string} EPG.epgCardsChannelActiveBg
 *   @param {string} [EPG.epgCardsHeaderBg]
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
      // --- Tema visual (colores CSS: hex, rgba, gradiente o var(--primary-color)) ---
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)", // Fondo de la tarjeta central del formulario
        submitBg: "#004c77", // Fondo del botón principal "Entrar"
        submitText: "#ffffff", // Texto del botón "Entrar"
        registerBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Registrarse" (QR)
        registerText: "#ffffff", // Texto del botón "Registrarse"
        udidBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Login UDID"
        udidText: "#ffffff", // Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)", // Fondo del botón mostrar/ocultar contraseña
        toggleText: "rgba(255, 255, 255, 0.7)", // Texto del toggle de contraseña
        inputs: {
          bg: "rgba(255, 255, 255, 0.1)", // Fondo campos usuario/contraseña
          border: "rgba(255, 255, 255, 0.2)", // Borde de los campos
          text: "#ffffff", // Color del texto escrito
          placeholder: "rgba(255, 255, 255, 0.4)", // Color del placeholder
          focusedBg: "rgba(255, 255, 255, 0.15)", // Fondo cuando el campo tiene foco (TV/teclado)
          focusedBorder: null, // Borde con foco; null = usa ui.primaryColor
          focusedShadow: null, // Sombra con foco; null = usa anillo primaryColor
        },
        social: {
          bg: "rgba(255, 255, 255, 0.08)", // Fondo botones Google/Facebook (fallback custom)
          border: "rgba(255, 255, 255, 0.22)", // Borde botones sociales
          text: "rgba(255, 255, 255, 0.92)", // Texto botones sociales
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo botón cerrar modal QR/UDID
        modalCloseText: "#ffffff", // Texto botón cerrar modal
        linkColor: null, // Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor
        dividerColor: "rgba(255, 255, 255, 0.25)", // Línea del separador "o"
      },
      // --- Imagen de fondo de pantalla completa ---
      backgroundImage: {
        enabled: true, // true: usa assetPath; false: usa assets.background o background.png por defecto
        assetPath: "backgroundalt.webp", // Archivo en la carpeta de assets de la marca
      },
      // --- Registro por código QR ---
      qrRegister: {
        enabled: true, // Muestra botón y modal de registro con QR
        url: "https://shop.fotelka.tv/?c=customer&p=register", // URL codificada en el QR de registro
      },
      // --- Enlace "Olvidé contraseña" ---
      forgotPassword: {
        enabled: true, // Muestra enlace debajo del campo contraseña
        url: "https://shop.fotelka.tv/?c=customer&p=reset_password", // URL destino al hacer clic; vacío = no navega
      },
      // --- Login remoto por UDID (TV escanea QR, móvil/web confirma) ---
      udid: {
        enabled: true, // Muestra botón y flujo UDID
        baseUrl: "http://127.0.0.1:8001", // Base HTTP del backend UDID
        requestPath: "/udid/request-udid-manual/", // Endpoint POST para solicitar código UDID
        wsUrl: "ws://127.0.0.1:8001/ws/auth/", // WebSocket para recibir credenciales cifradas
        appType: "web", // Tipo de app enviado al backend (valor genérico seguro; TODO: usar resolveEnginePlatform() para lg/samsung cuando corresponda)
        appVersion: "1.0", // Versión enviada al backend
        maxReconnectAttempts: 3, // Reintentos máximos de reconexión WebSocket
        reconnectMs: [3000, 6000, 10000], // Delays entre reintentos (ms)
        heartbeatMs: 30000, // Intervalo de ping WebSocket (ms)
        privateKeyUrl: "/cableatlantico/keys/private_key.pem", // Ruta pública PEM para descifrar encrypted_credentials (fallback si WebCrypto no soporta llave efímera)
        tempTokenRequired: true, // Este backend (Wind) exige temp_token + soporta llave efímera por pareo -- NO activar en brands que apunten a otros backends (ver "intv")
      },
      // --- Login social (Google / Facebook); oculto en TV ---
      socialLogin: {
        backendBaseUrl: "http://backend.wind.do", // Base común; alternativa env: VITE_SOCIAL_AUTH_BASE_URL
        google: {
          enabled: true, // Muestra botón Google (solo escritorio)
          redirectUrl: "/wind/auth/google/", // Path relativo a backendBaseUrl o URL absoluta del POST OAuth
          accessToken: "487078023200-686hite4p619jtaobfa4oksvhoal7qc1.apps.googleusercontent.com", // Google OAuth client_id
          preferCustomButton: true, // true: botón custom con theme.social; false: widget GIS nativo
          backendBaseUrl: "", // Base específica Google; vacío = usa socialLogin.backendBaseUrl
        },
        facebook: {
          enabled: true, // Muestra botón Facebook (solo escritorio)
          redirectUrl: "/wind/auth/facebook/", // Path relativo o URL absoluta del POST OAuth
          accessToken: "823584907447149", // Facebook App ID
          backendBaseUrl: "", // Base específica Facebook; vacío = usa socialLogin.backendBaseUrl
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#2CE308",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: false,
      epgCardsChannelActiveBg: "#0A4385",
      epgCardsHeaderBg: "#5880afff", // Color de fondo de la cabecera de la guía de canales
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
      // Buscador (/home/buscador)
      search: {
        overlayBg: 'rgba(0, 0, 0, 0.55)',
        panelBg: 'rgba(0, 0, 0, 0.92)',
        header: {
          bg: '#1a3a4a',
          text: '#ffffff',
        },
        input: {
          bg: 'transparent',
          text: '#ffffff',
          placeholder: 'rgba(255, 255, 255, 0.45)',
          focusedBg: 'rgba(255, 255, 255, 0.08)',
          focusedBorder: '#004c77',
          focusedShadow: '0 0 0 2px rgba(0, 76, 119, 0.45)',
        },
        clearButton: {
          bg: '#c0392b',
          text: '#ffffff',
          hoverBg: '#e74c3c',
        },
        tabs: {
          bg: 'rgba(255, 255, 255, 0.08)',
          text: 'rgba(255, 255, 255, 0.9)',
          hoverBg: 'rgba(255, 255, 255, 0.18)',
          activeBg: '#004c77',
          activeText: '#ffffff',
          activeHoverBg: '#003a5c',
        },
        results: {
          areaBg: '#141f26',
          cardBg: '#1a3a4a',
          cardBorder: '#2a5568',
          cardHoverBg: '#254a5c',
          cardFocusBorder: '#004c77',
          titleText: '#ffffff',
          metaText: 'rgba(255, 255, 255, 0.65)',
          sectionTitleBg: 'rgba(255, 255, 255, 0.06)',
          thumbBg: 'rgba(255, 255, 255, 0.06)',
        },
        empty: {
          text: 'rgba(255, 255, 255, 0.75)',
          countText: 'rgba(255, 255, 255, 0.65)',
        },
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
      // --- Tema visual (colores CSS: hex, rgba, gradiente o var(--primary-color)) ---
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)", // Fondo de la tarjeta central del formulario
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo del botón principal "Entrar"
        submitText: "#ffffff", // Texto del botón "Entrar"
        registerBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Registrarse" (QR)
        registerText: "#ffffff", // Texto del botón "Registrarse"
        udidBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Login UDID"
        udidText: "#ffffff", // Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)", // Fondo del botón mostrar/ocultar contraseña
        toggleText: "rgba(255, 255, 255, 0.7)", // Texto del toggle de contraseña
        inputs: {
          bg: "rgba(255, 255, 255, 0.1)", // Fondo campos usuario/contraseña
          border: "rgba(255, 255, 255, 0.2)", // Borde de los campos
          text: "#ffffff", // Color del texto escrito
          placeholder: "rgba(255, 255, 255, 0.4)", // Color del placeholder
          focusedBg: "rgba(255, 255, 255, 0.15)", // Fondo cuando el campo tiene foco (TV/teclado)
          focusedBorder: null, // Borde con foco; null = usa ui.primaryColor
          focusedShadow: null, // Sombra con foco; null = usa anillo primaryColor
        },
        social: {
          bg: "rgba(255, 255, 255, 0.08)", // Fondo botones Google/Facebook (fallback custom)
          border: "rgba(255, 255, 255, 0.22)", // Borde botones sociales
          text: "rgba(255, 255, 255, 0.92)", // Texto botones sociales
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo botón cerrar modal QR/UDID
        modalCloseText: "#ffffff", // Texto botón cerrar modal
        linkColor: null, // Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor
        dividerColor: "rgba(255, 255, 255, 0.25)", // Línea del separador "o"
      },
      // --- Imagen de fondo de pantalla completa ---
      backgroundImage: {
        enabled: false, // true: usa assetPath; false: usa assets.background o background.png por defecto
        assetPath: "backgroundalt.webp", // Archivo en la carpeta de assets de la marca
      },
      // --- Registro por código QR ---
      qrRegister: {
        enabled: true, // Muestra botón y modal de registro con QR
        url: "https://portal.in.tv.br/#/login", // URL codificada en el QR de registro
      },
      // --- Enlace "Olvidé contraseña" ---
      forgotPassword: {
        enabled: true, // Muestra enlace debajo del campo contraseña
        url: "https://portal.in.tv.br/#/forgot-password", // URL destino al hacer clic; vacío = no navega
      },
      // --- Login remoto por UDID (TV escanea QR, móvil/web confirma) ---
      udid: {
        enabled: true, // Muestra botón y flujo UDID
        baseUrl: "https://intv-payment.in.tv.br/", // Base HTTP del backend UDID
        requestPath: "/api/devices/request-access/", // Endpoint POST para solicitar código UDID
        wsUrl: "wss://intv-payment.in.tv.br/ws/device-access/", // WebSocket para recibir credenciales cifradas
        appType: "10foot", // Tipo de app enviado al backend
        appVersion: "1.0", // Versión enviada al backend
        maxReconnectAttempts: 3, // Reintentos máximos de reconexión WebSocket
        reconnectMs: [3000, 6000, 10000], // Delays entre reintentos (ms)
        heartbeatMs: 30000, // Intervalo de ping WebSocket (ms)
        privateKeyUrl: "", // Ruta pública PEM para descifrar encrypted_credentials
      },
      // --- Login social (Google / Facebook); oculto en TV ---
      socialLogin: {
        backendBaseUrl: "http://127.0.0.1:8000", // Base común; alternativa env: VITE_SOCIAL_AUTH_BASE_URL
        google: {
          enabled: true, // Muestra botón Google (solo escritorio)
          redirectUrl: "", // Path relativo a backendBaseUrl o URL absoluta del POST OAuth
          accessToken: "184856008395-25a3h9o078l4rch61236f45t8qg8f04d.apps.googleusercontent.com", // Google OAuth client_id
          preferCustomButton: true, // true: botón custom con theme.social; false: widget GIS nativo
          backendBaseUrl: "", // Base específica Google; vacío = usa socialLogin.backendBaseUrl
        },
        facebook: {
          enabled: true, // Muestra botón Facebook (solo escritorio)
          redirectUrl: "", // Path relativo o URL absoluta del POST OAuth
          accessToken: "7198627023533757", // Facebook App ID
          backendBaseUrl: "", // Base específica Facebook; vacío = usa socialLogin.backendBaseUrl
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "#6C8EB6", // Color de fondo del canal activo
      epgCardsHeaderBg: "#104c91ff", // Color de fondo de la cabecera de la guía de canales
      epgCardsProgramLiveBg: "#2d79d1ff", // Color de fondo del programa en vivo
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
      // Buscador (/home/buscador)
      search: {
        overlayBg: 'rgba(0, 0, 0, 0.35)',
        panelBg: 'rgba(248, 249, 255, 0.98)',
        header: {
          bg: '#e8ebff',
          text: '#1a1a2e',
        },
        input: {
          bg: 'rgba(255, 255, 255, 0.85)',
          text: '#1a1a2e',
          placeholder: 'rgba(26, 26, 46, 0.45)',
          focusedBg: '#ffffff',
          focusedBorder: '#3355FF',
          focusedShadow: '0 0 0 2px rgba(51, 85, 255, 0.35)',
        },
        clearButton: {
          bg: '#dc3545',
          text: '#ffffff',
          hoverBg: '#c82333',
        },
        tabs: {
          bg: 'rgba(51, 85, 255, 0.1)',
          text: 'rgba(26, 26, 46, 0.85)',
          hoverBg: 'rgba(51, 85, 255, 0.18)',
          activeBg: '#3355FF',
          activeText: '#ffffff',
          activeHoverBg: '#2244dd',
        },
        results: {
          areaBg: '#eceef8',
          cardBg: '#ffffff',
          cardBorder: '#d0d5f0',
          cardHoverBg: '#f0f2ff',
          cardFocusBorder: '#3355FF',
          titleText: '#1a1a2e',
          metaText: 'rgba(26, 26, 46, 0.65)',
          sectionTitleBg: 'rgba(51, 85, 255, 0.08)',
          thumbBg: 'rgba(51, 85, 255, 0.06)',
        },
        empty: {
          text: 'rgba(26, 26, 46, 0.75)',
          countText: 'rgba(26, 26, 46, 0.55)',
        },
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
        heroGradientOpacity: 1.0, // Opacidad del gradiente inferior del hero (0–1)    
        posterWidthMin: 100, // Ancho mínimo del poster en px
        posterWidthMax: 200, // Ancho máximo del poster en px
        categoryTagBackground: "rgba(255, 255, 255, 0.12)", // Color/fondo de las etiquetas de categoría (css)
        categoryTagBorderColor: "rgba(255, 255, 255, 0.2)", // Borde de las etiquetas de categoría (css)
        parentalBadgeBorderColor: "rgba(255, 255, 255, 0.5)", // Borde del badge de clasificación por edades (css)
        contentPosition: "bottom", // "top" | "middle" | "bottom" - posición vertical del bloque poster + info
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
      // --- Tema visual (colores CSS: hex, rgba, gradiente o var(--primary-color)) ---
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)", // Fondo de la tarjeta central del formulario
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo del botón principal "Entrar"
        submitText: "#ffffff", // Texto del botón "Entrar"
        registerBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Registrarse" (QR)
        registerText: "#ffffff", // Texto del botón "Registrarse"
        udidBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Login UDID"
        udidText: "#ffffff", // Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)", // Fondo del botón mostrar/ocultar contraseña
        toggleText: "rgba(255, 255, 255, 0.7)", // Texto del toggle de contraseña
        inputs: {
          bg: "rgba(255, 255, 255, 0.1)", // Fondo campos usuario/contraseña
          border: "rgba(255, 255, 255, 0.2)", // Borde de los campos
          text: "#ffffff", // Color del texto escrito
          placeholder: "rgba(255, 255, 255, 0.4)", // Color del placeholder
          focusedBg: "rgba(255, 255, 255, 0.15)", // Fondo cuando el campo tiene foco (TV/teclado)
          focusedBorder: null, // Borde con foco; null = usa ui.primaryColor
          focusedShadow: null, // Sombra con foco; null = usa anillo primaryColor
        },
        social: {
          bg: "rgba(255, 255, 255, 0.08)", // Fondo botones Google/Facebook (fallback custom)
          border: "rgba(255, 255, 255, 0.22)", // Borde botones sociales
          text: "rgba(255, 255, 255, 0.92)", // Texto botones sociales
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo botón cerrar modal QR/UDID
        modalCloseText: "#ffffff", // Texto botón cerrar modal
        linkColor: null, // Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor
        dividerColor: "rgba(255, 255, 255, 0.25)", // Línea del separador "o"
      },
      // --- Imagen de fondo de pantalla completa ---
      backgroundImage: {
        enabled: false, // true: usa assetPath; false: usa assets.background o background.png por defecto
        assetPath: "backgroundalt.webp", // Archivo en la carpeta de assets de la marca
      },
      // --- Registro por código QR ---
      qrRegister: {
        enabled: false, // Muestra botón y modal de registro con QR
        url: "https://shop.fotelka.tv/?c=customer&p=register", // URL codificada en el QR de registro
      },
      // --- Enlace "Olvidé contraseña" ---
      forgotPassword: {
        enabled: false, // Muestra enlace debajo del campo contraseña
        url: "", // URL destino al hacer clic; vacío = no navega
      },
      // --- Login remoto por UDID (TV escanea QR, móvil/web confirma) ---
      udid: {
        enabled: false, // Muestra botón y flujo UDID
        baseUrl: "", // Base HTTP del backend UDID
        requestPath: "", // Endpoint POST para solicitar código UDID
        wsUrl: "", // WebSocket para recibir credenciales cifradas
        appType: "10foot", // Tipo de app enviado al backend
        appVersion: "1.0", // Versión enviada al backend
        maxReconnectAttempts: 3, // Reintentos máximos de reconexión WebSocket
        reconnectMs: [3000, 6000, 10000], // Delays entre reintentos (ms)
        heartbeatMs: 30000, // Intervalo de ping WebSocket (ms)
        privateKeyUrl: "", // Ruta pública PEM para descifrar encrypted_credentials
      },
      // --- Login social (Google / Facebook); oculto en TV ---
      socialLogin: {
        backendBaseUrl: "http://127.0.0.1:8000", // Base común; alternativa env: VITE_SOCIAL_AUTH_BASE_URL
        google: {
          enabled: false, // Muestra botón Google (solo escritorio)
          redirectUrl: "/wind/auth/google/", // Path relativo a backendBaseUrl o URL absoluta del POST OAuth
          accessToken: "803252352997-o8lj65s1h9ga2he9hu02vbflc4h749hv.apps.googleusercontent.com", // Google OAuth client_id
          preferCustomButton: true, // true: botón custom con theme.social; false: widget GIS nativo
          backendBaseUrl: "", // Base específica Google; vacío = usa socialLogin.backendBaseUrl
        },
        facebook: {
          enabled: false, // Muestra botón Facebook (solo escritorio)
          redirectUrl: "/wind/auth/facebook/", // Path relativo o URL absoluta del POST OAuth
          accessToken: "823584907447149", // Facebook App ID
          backendBaseUrl: "", // Base específica Facebook; vacío = usa socialLogin.backendBaseUrl
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#2CE308",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "#0A4385",
      epgCardsHeaderBg: "rgb(0 0 0)", // Color de fondo de la cabecera de la guía de canales
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
      // Buscador (/home/buscador)
      search: {
        overlayBg: 'rgba(0, 0, 0, 0.55)',
        panelBg: 'rgba(0, 0, 0, 0.92)',
        header: {
          bg: '#2a2018',
          text: '#ffffff',
        },
        input: {
          bg: 'transparent',
          text: '#ffffff',
          placeholder: 'rgba(255, 255, 255, 0.45)',
          focusedBg: 'rgba(255, 107, 53, 0.12)',
          focusedBorder: '#FF6B35',
          focusedShadow: '0 0 0 2px rgba(255, 107, 53, 0.4)',
        },
        clearButton: {
          bg: '#c0392b',
          text: '#ffffff',
          hoverBg: '#e74c3c',
        },
        tabs: {
          bg: 'rgba(255, 255, 255, 0.08)',
          text: 'rgba(255, 255, 255, 0.9)',
          hoverBg: 'rgba(255, 255, 255, 0.18)',
          activeBg: '#FF6B35',
          activeText: '#ffffff',
          activeHoverBg: '#cc5528',
        },
        results: {
          areaBg: '#1a1410',
          cardBg: '#2a2018',
          cardBorder: '#4a3528',
          cardHoverBg: '#3d2e22',
          cardFocusBorder: '#FF6B35',
          titleText: '#ffffff',
          metaText: 'rgba(255, 255, 255, 0.65)',
          sectionTitleBg: 'rgba(255, 107, 53, 0.1)',
          thumbBg: 'rgba(255, 255, 255, 0.06)',
        },
        empty: {
          text: 'rgba(255, 255, 255, 0.75)',
          countText: 'rgba(255, 255, 255, 0.65)',
        },
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
      // --- Tema visual (colores CSS: hex, rgba, gradiente o var(--primary-color)) ---
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)", // Fondo de la tarjeta central del formulario
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo del botón principal "Entrar"
        submitText: "#ffffff", // Texto del botón "Entrar"
        registerBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Registrarse" (QR)
        registerText: "#ffffff", // Texto del botón "Registrarse"
        udidBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Login UDID"
        udidText: "#ffffff", // Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)", // Fondo del botón mostrar/ocultar contraseña
        toggleText: "rgba(255, 255, 255, 0.7)", // Texto del toggle de contraseña
        inputs: {
          bg: "rgba(255, 255, 255, 0.1)", // Fondo campos usuario/contraseña
          border: "rgba(255, 255, 255, 0.2)", // Borde de los campos
          text: "#ffffff", // Color del texto escrito
          placeholder: "rgba(255, 255, 255, 0.4)", // Color del placeholder
          focusedBg: "rgba(255, 255, 255, 0.15)", // Fondo cuando el campo tiene foco (TV/teclado)
          focusedBorder: null, // Borde con foco; null = usa ui.primaryColor
          focusedShadow: null, // Sombra con foco; null = usa anillo primaryColor
        },
        social: {
          bg: "rgba(255, 255, 255, 0.08)", // Fondo botones Google/Facebook (fallback custom)
          border: "rgba(255, 255, 255, 0.22)", // Borde botones sociales
          text: "rgba(255, 255, 255, 0.92)", // Texto botones sociales
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo botón cerrar modal QR/UDID
        modalCloseText: "#ffffff", // Texto botón cerrar modal
        linkColor: null, // Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor
        dividerColor: "rgba(255, 255, 255, 0.25)", // Línea del separador "o"
      },
      // --- Imagen de fondo de pantalla completa ---
      backgroundImage: {
        enabled: false, // true: usa assetPath; false: usa assets.background o background.png por defecto
        assetPath: "backgroundalt.webp", // Archivo en la carpeta de assets de la marca
      },
      // --- Registro por código QR ---
      qrRegister: {
        enabled: false, // Muestra botón y modal de registro con QR
        url: "https://shop.fotelka.tv/?c=customer&p=register", // URL codificada en el QR de registro
      },
      // --- Enlace "Olvidé contraseña" ---
      forgotPassword: {
        enabled: false, // Muestra enlace debajo del campo contraseña
        url: "", // URL destino al hacer clic; vacío = no navega
      },
      // --- Login remoto por UDID (TV escanea QR, móvil/web confirma) ---
      udid: {
        enabled: true, // Muestra botón y flujo UDID
        baseUrl: "http://127.0.0.1:8000", // Base HTTP del backend UDID
        requestPath: "/udid/request-udid-manual/", // Endpoint POST para solicitar código UDID
        wsUrl: "ws://127.0.0.1:8000/ws/auth/", // WebSocket para recibir credenciales cifradas
        appType: "web", // Tipo de app enviado al backend (valor genérico seguro; TODO: usar resolveEnginePlatform() para lg/samsung cuando corresponda)
        appVersion: "1.0", // Versión enviada al backend
        maxReconnectAttempts: 3, // Reintentos máximos de reconexión WebSocket
        reconnectMs: [3000, 6000, 10000], // Delays entre reintentos (ms)
        heartbeatMs: 30000, // Intervalo de ping WebSocket (ms)
        privateKeyUrl: "/cableatlantico/keys/private_key.pem", // Ruta pública PEM para descifrar encrypted_credentials (fallback si WebCrypto no soporta llave efímera)
        tempTokenRequired: true, // Este backend (Wind) exige temp_token + soporta llave efímera por pareo -- NO activar en brands que apunten a otros backends (ver "intv")
      },
      // --- Login social (Google / Facebook); oculto en TV ---
      socialLogin: {
        backendBaseUrl: "", // Base común; alternativa env: VITE_SOCIAL_AUTH_BASE_URL
        google: {
          enabled: false, // Muestra botón Google (solo escritorio)
          redirectUrl: "", // Path relativo a backendBaseUrl o URL absoluta del POST OAuth
          accessToken: "", // Google OAuth client_id
          preferCustomButton: true, // true: botón custom con theme.social; false: widget GIS nativo
          backendBaseUrl: "", // Base específica Google; vacío = usa socialLogin.backendBaseUrl
        },
        facebook: {
          enabled: false, // Muestra botón Facebook (solo escritorio)
          redirectUrl: "", // Path relativo o URL absoluta del POST OAuth
          accessToken: "", // Facebook App ID
          backendBaseUrl: "", // Base específica Facebook; vacío = usa socialLogin.backendBaseUrl
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 3, // Días de offset para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      epgPast: true,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)", // Color de fondo del canal activo
      epgCardsHeaderBg: "rgb(0 0 0)", // Color de fondo de la cabecera de la guía de canales
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
      // Buscador (/home/buscador)
      search: {
        overlayBg: 'rgba(0, 0, 0, 0.35)',
        panelBg: 'rgba(248, 248, 255, 0.98)',
        header: {
          bg: '#e8e8ff',
          text: '#1a1a2e',
        },
        input: {
          bg: 'rgba(255, 255, 255, 0.85)',
          text: '#1a1a2e',
          placeholder: 'rgba(26, 26, 46, 0.45)',
          focusedBg: '#ffffff',
          focusedBorder: '#3333FF',
          focusedShadow: '0 0 0 2px rgba(51, 51, 255, 0.35)',
        },
        clearButton: {
          bg: '#dc3545',
          text: '#ffffff',
          hoverBg: '#c82333',
        },
        tabs: {
          bg: 'rgba(51, 51, 255, 0.1)',
          text: 'rgba(26, 26, 46, 0.85)',
          hoverBg: 'rgba(51, 51, 255, 0.18)',
          activeBg: '#3333FF',
          activeText: '#ffffff',
          activeHoverBg: '#1a1aaa',
        },
        results: {
          areaBg: '#ececf5',
          cardBg: '#ffffff',
          cardBorder: '#d0d0f0',
          cardHoverBg: '#f0f0ff',
          cardFocusBorder: '#3333FF',
          titleText: '#1a1a2e',
          metaText: 'rgba(26, 26, 46, 0.65)',
          sectionTitleBg: 'rgba(51, 51, 255, 0.08)',
          thumbBg: 'rgba(51, 51, 255, 0.06)',
        },
        empty: {
          text: 'rgba(26, 26, 46, 0.75)',
          countText: 'rgba(26, 26, 46, 0.55)',
        },
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
    drm: "https://middleware.wind.do/",
    token: '',
    os: 'HTML5',
    appVersion: '1',    
    branding: 'Panaccess',
    developedBy: "windplay",
    version: "1.0.0",

    login: {
      // --- Tema visual (colores CSS: hex, rgba, gradiente o var(--primary-color)) ---
      theme: {
        cardBackground: "rgba(22, 32, 45, 0.96)", // Fondo de la tarjeta central del formulario
        submitBg: "#99bbd3", // Fondo del botón principal "Entrar"
        submitText: "#16202d", // Texto del botón "Entrar"
        registerBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Registrarse" (QR)
        registerText: "#ffffff", // Texto del botón "Registrarse"
        udidBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Login UDID"
        udidText: "#ffffff", // Texto del botón UDID
        toggleBg: "transparent", // Fondo del botón mostrar/ocultar contraseña
        toggleText: "rgba(255, 255, 255, 0.55)", // Texto del toggle de contraseña
        inputs: {
          bg: "rgba(12, 18, 28, 0.85)", // Fondo campos usuario/contraseña
          border: "rgba(255, 255, 255, 0.85)", // Borde de los campos
          text: "#ffffff", // Color del texto escrito
          placeholder: "rgba(255, 255, 255, 0.45)", // Color del placeholder
          focusedBg: "rgba(12, 18, 28, 0.95)", // Fondo cuando el campo tiene foco (TV/teclado)
          focusedBorder: "#99bbd3", // Borde con foco; null = usa ui.primaryColor
          focusedShadow: null, // Sombra con foco; null = usa anillo primaryColor
        },
        social: {
          bg: "transparent", // Fondo botones Google/Facebook (fallback custom)
          border: "rgba(153, 187, 211, 0.65)", // Borde botones sociales
          text: "#ffffff", // Texto botones sociales
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo botón cerrar modal QR/UDID
        modalCloseText: "#ffffff", // Texto botón cerrar modal
        linkColor: "#99bbd3", // Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor
        dividerColor: "rgba(255, 255, 255, 0.25)", // Línea del separador "o"
      },
      // --- Imagen de fondo de pantalla completa ---
      backgroundImage: {
        enabled: true, // true: usa assetPath; false: usa assets.background o background.png por defecto
        assetPath: "backgroundalt.webp", // Archivo en la carpeta de assets de la marca
      },
      // --- Registro por código QR ---
      qrRegister: {
        enabled: false, // Muestra botón y modal de registro con QR
        url: "https://backend.wind.do/wind/register/", // URL codificada en el QR de registro
      },
      // --- Enlace "Olvidé contraseña" ---
      forgotPassword: {
        enabled: true, // Muestra enlace debajo del campo contraseña
        url: "https://backend.wind.do/wind/forgot-password/", // URL destino al hacer clic; vacío = no navega
      },
      // --- Login remoto por UDID (TV escanea QR, móvil/web confirma) ---
      udid: {
        enabled: false, // Muestra botón y flujo UDID
        baseUrl: "", // Base HTTP del backend UDID
        requestPath: "", // Endpoint POST para solicitar código UDID
        wsUrl: "", // WebSocket para recibir credenciales cifradas
        appType: "10foot", // Tipo de app enviado al backend
        appVersion: "1.0", // Versión enviada al backend
        maxReconnectAttempts: 3, // Reintentos máximos de reconexión WebSocket
        reconnectMs: [3000, 6000, 10000], // Delays entre reintentos (ms)
        heartbeatMs: 30000, // Intervalo de ping WebSocket (ms)
        privateKeyUrl: "", // Ruta pública PEM para descifrar encrypted_credentials
      },
      // --- Login social (Google / Facebook); oculto en TV ---
      socialLogin: {
        backendBaseUrl: "https://backend.wind.do", // Base común; alternativa env: VITE_SOCIAL_AUTH_BASE_URL
        google: {
          enabled: true, // Muestra botón Google (solo escritorio)
          redirectUrl: "/wind/auth/google/", // Path relativo a backendBaseUrl o URL absoluta del POST OAuth
          accessToken: "487078023200-686hite4p619jtaobfa4oksvhoal7qc1.apps.googleusercontent.com", // Google OAuth client_id
          preferCustomButton: true, // true: botón custom con theme.social; false: widget GIS nativo
          backendBaseUrl: "", // Base específica Google; vacío = usa socialLogin.backendBaseUrl
        },
        facebook: {
          enabled: true, // Muestra botón Facebook (solo escritorio)
          redirectUrl: "/wind/auth/facebook/", // Path relativo o URL absoluta del POST OAuth
          accessToken: "823584907447149", // Facebook App ID
          backendBaseUrl: "", // Base específica Facebook; vacío = usa socialLogin.backendBaseUrl
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF", //Color de la linea que indica la hora actual en la guia
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
      epgPast: false,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)", //Color de fondo de la tarjeta cuando esta seleccionada
      epgCardsHeaderBg: "rgb(0 0 0)", // Color de fondo de la cabecera de la guía de canales
      epgCardsProgramLiveBg: "#6C8EB6", //Color de fondo del programa en vivo
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
      // Buscador (/home/buscador)
      search: {
        overlayBg: '#00182D', // Capa oscura detrás del panel de búsqueda
        panelBg: '#012B4F', // Fondo del panel principal del buscador
        header: {
          bg: '#012B4F', // Fondo de la barra superior (input + botón limpiar)
          text: '#ffffff', // Color de texto en la barra superior
        },
        input: {
          bg: 'transparent', // Fondo del campo de búsqueda
          text: '#ffffff', // Color del texto que escribe el usuario
          placeholder: '#ffffff', // Color del placeholder ("Buscar…")
          focusedBg: '#012B4F', // Fondo del input al enfocar (TV/PC)
          focusedBorder: '#012B4F', // Borde del input al enfocar
          focusedShadow: '0 0 0 2px #3AA3AE', // Sombra/anillo del input al enfocar
        },
        clearButton: {
          bg: '#012B4F', // Fondo del botón "Limpiar"
          text: '#ffffff', // Texto del botón "Limpiar"
          hoverBg: '#012B4F', // Fondo del botón "Limpiar" en hover/foco
        },
        tabs: {
          bg: '#012B4F', // Fondo de pestañas inactivas (Todos, TV, VOD…)
          text: '#ffffff', // Texto de pestañas inactivas
          hoverBg: '#012B4F', // Fondo de pestaña inactiva en hover/foco
          activeBg: '#3AA3AE', // Fondo de la pestaña seleccionada
          activeText: '#ffffff', // Texto de la pestaña seleccionada
          activeHoverBg: '#012B4F', // Fondo de pestaña activa en hover/foco
        },
        results: {
          areaBg: '#012B4F', // Fondo del área con scroll de resultados
          cardBg: '#012B4F', // Fondo de cada tarjeta de resultado
          cardBorder: '#012B4F', // Borde de cada tarjeta
          cardHoverBg: '#134a6b', // Fondo de tarjeta en hover/foco
          cardFocusBorder: '#012B4F', // Borde de tarjeta en hover/foco (mando TV)
          titleText: '#ffffff', // Títulos, nombres de canal y eventos
          metaText: '#ffffff', // Metadatos: hora EPG, actor, director, año VOD
          sectionTitleBg: '#012B4F', // Fondo del título de sección en tab "Todos"
          thumbBg: '#012B4F', // Fondo de miniatura o placeholder sin imagen
        },
        empty: {
          text: 'rgba(255, 255, 255, 0.75)', // Mensaje cuando no hay resultados
          countText: 'rgba(255, 255, 255, 0.65)', // Texto del contador "X resultados"
        },
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
      // --- Tema visual (colores CSS: hex, rgba, gradiente o var(--primary-color)) ---
      theme: {
        cardBackground: "rgba(255, 255, 255, 0.05)", // Fondo de la tarjeta central del formulario
        submitBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo del botón principal "Entrar"
        submitText: "#ffffff", // Texto del botón "Entrar"
        registerBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Registrarse" (QR)
        registerText: "#ffffff", // Texto del botón "Registrarse"
        udidBg: "rgba(255, 255, 255, 0.12)", // Fondo del botón "Login UDID"
        udidText: "#ffffff", // Texto del botón UDID
        toggleBg: "rgba(255, 255, 255, 0.1)", // Fondo del botón mostrar/ocultar contraseña
        toggleText: "rgba(255, 255, 255, 0.7)", // Texto del toggle de contraseña
        inputs: {
          bg: "rgba(255, 255, 255, 0.1)", // Fondo campos usuario/contraseña
          border: "rgba(255, 255, 255, 0.2)", // Borde de los campos
          text: "#ffffff", // Color del texto escrito
          placeholder: "rgba(255, 255, 255, 0.4)", // Color del placeholder
          focusedBg: "rgba(255, 255, 255, 0.15)", // Fondo cuando el campo tiene foco (TV/teclado)
          focusedBorder: null, // Borde con foco; null = usa ui.primaryColor
          focusedShadow: null, // Sombra con foco; null = usa anillo primaryColor
        },
        social: {
          bg: "rgba(255, 255, 255, 0.08)", // Fondo botones Google/Facebook (fallback custom)
          border: "rgba(255, 255, 255, 0.22)", // Borde botones sociales
          text: "rgba(255, 255, 255, 0.92)", // Texto botones sociales
        },
        modalCloseBg: "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)", // Fondo botón cerrar modal QR/UDID
        modalCloseText: "#ffffff", // Texto botón cerrar modal
        linkColor: null, // Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor
        dividerColor: "rgba(255, 255, 255, 0.25)", // Línea del separador "o"
      },
      // --- Imagen de fondo de pantalla completa ---
      backgroundImage: {
        enabled: false, // true: usa assetPath; false: usa assets.background o background.png por defecto
        assetPath: "backgroundalt.webp", // Archivo en la carpeta de assets de la marca
      },
      // --- Registro por código QR ---
      qrRegister: {
        enabled: false, // Muestra botón y modal de registro con QR
        url: "https://shop.fotelka.tv/?c=customer&p=register", // URL codificada en el QR de registro
      },
      // --- Enlace "Olvidé contraseña" ---
      forgotPassword: {
        enabled: false, // Muestra enlace debajo del campo contraseña
        url: "", // URL destino al hacer clic; vacío = no navega
      },
      // --- Login remoto por UDID (TV escanea QR, móvil/web confirma) ---
      udid: {
        enabled: true, // Muestra botón y flujo UDID
        baseUrl: "", // Base HTTP del backend UDID
        requestPath: "", // Endpoint POST para solicitar código UDID
        wsUrl: "", // WebSocket para recibir credenciales cifradas
        appType: "10foot", // Tipo de app enviado al backend
        appVersion: "1.0", // Versión enviada al backend
        maxReconnectAttempts: 3, // Reintentos máximos de reconexión WebSocket
        reconnectMs: [3000, 6000, 10000], // Delays entre reintentos (ms)
        heartbeatMs: 30000, // Intervalo de ping WebSocket (ms)
        privateKeyUrl: "", // Ruta pública PEM para descifrar encrypted_credentials
      },
      // --- Login social (Google / Facebook); oculto en TV ---
      socialLogin: {
        backendBaseUrl: "http://127.0.0.1:8000/", // Base común; alternativa env: VITE_SOCIAL_AUTH_BASE_URL
        google: {
          enabled: true, // Muestra botón Google (solo escritorio)
          redirectUrl: "/wind/auth/google/", // Path relativo a backendBaseUrl o URL absoluta del POST OAuth
          accessToken: "803252352997-o8lj65s1h9ga2he9hu02vbflc4h749hv.apps.googleusercontent.com", // Google OAuth client_id
          preferCustomButton: true, // true: botón custom con theme.social; false: widget GIS nativo
          backendBaseUrl: "", // Base específica Google; vacío = usa socialLogin.backendBaseUrl
        },
        facebook: {
          enabled: true, // Muestra botón Facebook (solo escritorio)
          redirectUrl: "", // Path relativo o URL absoluta del POST OAuth
          accessToken: "", // Facebook App ID
          backendBaseUrl: "", // Base específica Facebook; vacío = usa socialLogin.backendBaseUrl
        },
      },
    },

    // EPG: configuración unificada (guía + cards)
    EPG: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#3333FF",
      reminderLeadSeconds: 60,
      reminderShowWhilePlaying: false,
      // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
      epgPast: false,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)",
      epgCardsHeaderBg: "rgb(0 0 0)", // Color de fondo de la cabecera de la guía de canales
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
      // Buscador (/home/buscador)
      search: {
        overlayBg: 'rgba(0, 0, 0, 0.55)',
        panelBg: 'rgba(1, 43, 79, 0.96)',
        header: {
          bg: '#0a2d4f',
          text: '#ffffff',
        },
        input: {
          bg: 'transparent',
          text: '#ffffff',
          placeholder: 'rgba(255, 255, 255, 0.45)',
          focusedBg: 'rgba(58, 163, 174, 0.12)',
          focusedBorder: '#3AA3AE',
          focusedShadow: '0 0 0 2px rgba(58, 163, 174, 0.45)',
        },
        clearButton: {
          bg: '#c0392b',
          text: '#ffffff',
          hoverBg: '#e74c3c',
        },
        tabs: {
          bg: 'rgba(255, 255, 255, 0.08)',
          text: 'rgba(255, 255, 255, 0.9)',
          hoverBg: 'rgba(255, 255, 255, 0.18)',
          activeBg: '#3AA3AE',
          activeText: '#ffffff',
          activeHoverBg: '#2C7F88',
        },
        results: {
          areaBg: '#061a2e',
          cardBg: '#0a2d4f',
          cardBorder: '#1a4a6e',
          cardHoverBg: '#134a6b',
          cardFocusBorder: '#3AA3AE',
          titleText: '#ffffff',
          metaText: 'rgba(255, 255, 255, 0.65)',
          sectionTitleBg: 'rgba(58, 163, 174, 0.12)',
          thumbBg: 'rgba(255, 255, 255, 0.06)',
        },
        empty: {
          text: 'rgba(255, 255, 255, 0.75)',
          countText: 'rgba(255, 255, 255, 0.65)',
        },
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

