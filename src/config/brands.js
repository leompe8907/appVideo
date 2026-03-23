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
 * @param {boolean} hashPasswordBeforeLogin - true: hashear contraseña en cliente antes de enviar (ej. Panaccess);
 *   false: enviar contraseña en claro (ej. backends como intv).
 *
 * @param {Object} bouquets - Configuración visual específica para bouquets:
 *   @param {string} bouquets.timeshipColor - Color (hex) de la barra de progreso (timeship) en los bouquets.
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

    // Configuración de UI/Tema
    ui: {
      // Splash
      splashDuration: 3000, // Duración en milisegundos
      splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
      // Logo
      logoPositionHome: "top", // "top" | "right" | "left" | "center"
      showTime: true, // Si es true → muestra el tiempo, si es false → no muestra el tiempo
      // EPG
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
    },

    // Configuración específica de bouquets
    bouquets: {
      // Color de la barra de progreso (timeship) en diseños event_and_logo, etc.
      timeshipColor: "#2CE308",
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
    api: {
      baseUrl: "", // Equivalente a baseUrl en 10foot
      wsUrl: "", // Equivalente a wsUrl en 10foot
    },
    vod: {
      layout: "hero",
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
    },

    // Configuración específica de bouquets
    bouquets: {
      timeshipColor: "#3333FF",
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
    api: {
      baseUrl: "", // Equivalente a baseUrl en 10foot
      wsUrl: "", // Equivalente a wsUrl en 10foot
    },
    vod: {
      layout: "classic", // "hero" | "classic"
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
    token: "NLdLsrJkgIgnxMIDurSI",
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
    },

    // Configuración específica de bouquets
    bouquets: {
      timeshipColor: "#2CE308",
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
    api: {
      baseUrl: "", // Equivalente a baseUrl en 10foot
      wsUrl: "", // Equivalente a wsUrl en 10foot
    },
    hashPasswordBeforeLogin: true,
    debug: {
      spatialNav: false,
      spatialNavVisual: false,
    },

    vod: {
      layout: "hero",
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

