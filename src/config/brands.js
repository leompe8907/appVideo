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
 *   @param {boolean} ui.splashAnimado - true: usa imagen animada (.gif); false: usa imagen estática (.png/.webp/.jpg).
 *   @param {string} ui.logoPositionHome - Posición del logo en la home: "top" | "right" | "left" | "center".
 *   @param {boolean} ui.showTime - true: muestra la hora en la UI; false: la oculta.
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
 *   @param {Object} ui.playerLoading - Estilo del overlay de carga de reproducción.
 *     @param {boolean} ui.playerLoading.premium - true: overlay premium (blur + gradientes + glow); false: overlay simple.
 *
 * @param {Object} features - Funcionalidades activas o no para esta marca:
 *   @param {boolean} features.miniPlayer - true: habilita el mini reproductor; false: lo deshabilita.
 *   @param {boolean} features.profiles - true: tras login redirige a /profile; false: redirige a /smartcard.
 *   @param {boolean} features.seekbar - true: habilita la barra de búsqueda del player; false: la oculta.
 *   @param {boolean} features.logout - true: muestra la opción de cerrar sesión en la UI; false: la oculta.
 *   @param {boolean} features.showRating - true: muestra la clasificación/rating de contenido; false: la oculta.
 *   @param {boolean} features.osms - true: habilita la integración OSMS y su menú; false: la deshabilita.
 *
 * @param {Object} api - Configuración de endpoints propios por marca:
 *   @param {string} api.baseUrl - URL base del backend propio (ej. validación de UDID, auth, etc.).
 *   @param {string} api.wsUrl - URL de WebSocket asociado (si aplica) para esta marca.
 *
 * @param {Object} qrRegister - Configuración de registro por QR en Login:
 *   @param {boolean} qrRegister.enabled - Habilita/deshabilita el botón/modal de registro QR.
 *   @param {string} qrRegister.url - URL destino codificada en el QR.
 *
 * @param {Object} udidLogin - Configuración de login por UDID:
 *   @param {boolean} udidLogin.enabled - Habilita/deshabilita el login externo por UDID.
 *   @param {string} udidLogin.baseUrl - Base del backend propio para request de UDID.
 *   @param {string} udidLogin.requestPath - Path para solicitar código UDID (default recomendado: /udid/request-udid-manual/).
 *   @param {string} udidLogin.wsUrl - WebSocket para esperar confirmación remota.
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
 */
export const BRANDS = [
  {
    brand: "bromteck",
    appName: "Bromteck",
    drm: 'https://cv01.panaccess.com/',
    token: 'gQposTlrMIOYQVdYBNYC',
    // Metadatos de integración con DRM (equivalentes al proyecto EPG clásico)
    os: 'HTML5',
    appVersion: '1',
    branding: 'Panaccess',
    developedBy: "Network Broadcast",
    version: "1.0.2",

    // EPG: parámetros generales para la API de guía de programación (mismo valor en todas las marcas)
    epg: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 200, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
      epgLineColorTime: "#2CE308",
    },

    // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
    epgCards: {
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

    // Catchup: pantalla independiente con 3 diseños (Legacy / Timeline / Netflix).
    // Nota: la UI se decide con `catchup.ui.activeLayout`; si `showAllLayouts` está en true
    // se renderizan los 3 para que el cliente pueda revisarlos.
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'legacy', // 'legacy' | 'timeline' | 'netflix'
        showAllLayouts: false, // para revisar los 3 diseños
      },
      layouts: {
        legacy: { enabled: true },
        timeline: { enabled: true },
        netflix: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    // nativeAdaptersEnabled=false mantiene WebEngine incluso en TV (modo seguro).
    // enginePolicy: 'auto' | 'force-web' | 'force-lg' | 'force-samsung'
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
      // Logo
      logoPositionHome: "top", // "top" | "right" | "left" | "center"
      showTime: true, // Si es true → muestra el tiempo, si es false → no muestra el tiempo
      // EPG
      epgLineColorTime: "#2CE308",
      // Colores
      primaryColor: "#2CE308", // Color principal de la marca (botones, acentos, etc.)
      secondaryColor: "#1a8a05", // Color secundario (hover, fondos, etc.)
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
      timeshipColor: "#2CE308",
    },

    // Cabecera Inicio (tres columnas); banderas por área (contenido se define luego).
    header: {
      areas: {
        left: { enabled: true, showLogo: true, showTime: false },
        center: { enabled: true, showLogo: false, showTime: false },
        right: { enabled: true, showLogo: false, showTime: true },
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
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true, // Si es true → muestra el mini player, si es false → no muestra el mini player
      profiles: false, // Si es true → redirige a /profile después del login, si es false → redirige a /smartcard después del login
      seekbar: true, // Equivalente a seekbarEnabled en 10foot
      logout: false, // Equivalente a logoutEnabled en 10foot
      showRating: true, // Equivalente a showRating en 10foot
      osms: false, // Equivalente a osmsEnabled en 10foot
    },
    qrRegister: {
      enabled: true,
      url: "https://shop.fotelka.tv/?c=customer&p=register",
    },
    udidLogin: {
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
  {
    brand: "intv",
    appName: "inTV Play",
    drm: "https://pmdw-1.in.tv.br/",
    token: "CEVQmnhOsXvpRQZbGADl",
    os: 'HTML5',
    appVersion: '1',
    branding: 'Panaccess',
    developedBy: "inTV&#174,",
    version: "2.0.2",

    // EPG: parámetros generales para la API de guía de programación (mismo valor en todas las marcas)
    epg: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
    },
    
    // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
    epgCards: {
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

    // Catchup: pantalla independiente con 3 diseños (Legacy / Timeline / Netflix).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'legacy',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        timeline: { enabled: true },
        netflix: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
      // Logo
      logoPositionHome: "right", // "top" | "right" | "left" | "center"
      showTime: false, // Si es true → muestra el tiempo, si es false → no muestra el tiempo
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
        backgroundColor: 'rgb(0, 0, 0)',
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
        left: { enabled: true, showLogo: false, showTime: false },
        center: { enabled: true, showLogo: false, showTime: false },
        right: { enabled: true, showLogo: false, showTime: true },
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
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true,
      profiles: false,
      seekbar: false, // Equivalente a seekbarEnabled en 10foot
      logout: false, // Equivalente a logoutEnabled en 10foot
      showRating: true, // Equivalente a showRating en 10foot
      osms: false, // Equivalente a osmsEnabled en 10foot
    },
    qrRegister: {
      enabled: true,
      url: "https://shop.fotelka.tv/?c=customer&p=register",
    },
    udidLogin: {
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
  {
    brand: "gigmax",
    appName: "Gigmax",
    drm: "https://cv10.panaccess.com/",
    token: "DDXXHySyAfrKgBczmhBk",
    os: 'HTML5',
    appVersion: '1',
    branding: 'Panaccess',
    developedBy: "Gigmax",
    version: "2.0.3",

    // EPG: parámetros generales para la API de guía de programación (mismo valor en todas las marcas)
    epg: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
    },
    
    // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
    epgCards: {
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

    // Catchup: pantalla independiente con 3 diseños (Legacy / Timeline / Netflix).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'legacy',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        timeline: { enabled: true },
        netflix: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
      // Logo
      logoPositionHome: "right", // "top" | "right" | "left" | "center"
      showTime: true, // Si es true → muestra el tiempo, si es false → no muestra el tiempo
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
        left: { enabled: true, showLogo: true, showTime: false },
        center: { enabled: true, showLogo: false, showTime: false },
        right: { enabled: true, showLogo: false, showTime: true },
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
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true,
      profiles: false,
      seekbar: false, // Equivalente a seekbarEnabled en 10foot
      logout: false, // Equivalente a logoutEnabled en 10foot
      showRating: false, // Equivalente a showRating en 10foot
      osms: false, // Equivalente a osmsEnabled en 10foot
    },
    qrRegister: {
      enabled: false,
      url: "",
    },
    udidLogin: {
      enabled: false,
      baseUrl: "",
      requestPath: "/udid/request-udid-manual/",
      wsUrl: "",
      appType: "10foot",
      appVersion: "1.0",
      maxReconnectAttempts: 3,
      reconnectMs: [3000, 6000, 10000],
      heartbeatMs: 30000,
      privateKeyUrl: "",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
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
  {
    brand: "cableatlantico",
    appName: "delancertv",
    drm: 'https://cv01.panaccess.com/', //"https://mw.cabledelancer.com/",
    token: "gQposTlrMIOYQVdYBNYC", //"ZteKaVByMTRHfqeHXtWK",
    os: 'HTML5',
    appVersion: '1',
    branding: 'Cabledelancer',
    developedBy: "Cabledelancer",
    version: "1.0.2",

    // EPG: parámetros generales para la API de guía de programación (mismo valor en todas las marcas)
    epg: {
      daysOffset: 2, // Días de offset para la API de guía de programación
      rowsOnInit: 7, // Número de filas iniciales para la API de guía de programación
      hoursLimit: 12, // Límite de horas para la API de guía de programación
    },
    
    // EPG (cards) - flags/colores de la guía estilo cards (migrado desde legacy)
    epgCards: {
      epgPast: true,
      epgPagesPastEnabled: true,
      epgCardsChannelActiveBg: "rgb(0 0 0)", // Color de fondo del canal activo
      epgCardsProgramLiveProgressBg: "#6C8EB6",// Color de la barra de progreso (programa en vivo / "Ahora")
      epgCardsLaterGlobal: true, // Mostrar programas pasados en la guía
      epgCloseModalOnPlayLive: 'auto', // Control del cierre de modal al reproducir en vivo: true = siempre cierra, false = nunca cierra, omitido/auto = cierra solo en TV.
    },

    // Catchup: pantalla independiente con 3 diseños (Legacy / Timeline / Netflix).
    catchup: {
      enabled: true,
      ui: {
        activeLayout: 'legacy',
        showAllLayouts: false,
      },
      layouts: {
        legacy: { enabled: true },
        timeline: { enabled: true },
        netflix: { enabled: true },
      },
    },

    // Player: control técnico de selección de engine por marca.
    player: {
      nativeAdaptersEnabled: false,
      enginePolicy: 'auto',
    },

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
      // Logo
      logoPositionHome: "right", // "top" | "right" | "left" | "center"
      showTime: false, // Si es true → muestra el tiempo, si es false → no muestra el tiempo
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
        left: { enabled: true, showLogo: true, showTime: false },
        center: { enabled: true, showLogo: false, showTime: false },
        right: { enabled: true, showLogo: false, showTime: true },
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
      },
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true,
      profiles: false,
      seekbar: false, // Equivalente a seekbarEnabled en 10foot
      logout: false, // Equivalente a logoutEnabled en 10foot
      showRating: true, // Equivalente a showRating en 10foot
      osms: false, // Equivalente a osmsEnabled en 10foot
    },
    qrRegister: {
      enabled: true,
      url: "https://shop.fotelka.tv/?c=customer&p=register",
    },
    udidLogin: {
      enabled: true,
      requestPath: "/udid/request-udid-manual/",
      baseUrl: "http://127.0.0.1:8000", //"https://bt-auth.cabledelancer.com",
      wsUrl: "ws://127.0.0.1:8000/ws/auth/", //"wss://bt-auth.cabledelancer.com/ws/auth/",
      appType: "10foot",
      appVersion: "1.0",
      maxReconnectAttempts: 3,
      reconnectMs: [3000, 6000, 10000],
      heartbeatMs: 30000,
      privateKeyUrl: "/cableatlantico/keys/private_key.pem",// Clave privada RSA-OAEP para descifrar `encrypted_credentials` del backend UDID.
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
  const brand = BRANDS.find(b => b.brand === brandName);
  return brand || null;
}

