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
 * @param {Object} debug - Opciones de depuración (normalmente solo en desarrollo):
 *   @param {boolean} debug.spatialNav - true: activa logs en consola de la navegación espacial.
 *   @param {boolean} debug.spatialNavVisual - true: muestra marcos rojos de debug para la navegación espacial.
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

