export const BRANDS = [
  {
    brand: "bromteck",
    appName: "Bromteck",
    drm: 'https://cv01.panaccess.com/',
    token: 'gQposTlrMIOYQVdYBNYC',
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
      primaryColor: "#2CE308",
      secondaryColor: "#1a8a05",
      theme: "dark",
      // Fuente
      fontFamily: "Arial, sans-serif",
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true, // Si es true → muestra el mini player, si es false → no muestra el mini player
      profiles: true, // Si es true → redirige a /profile después del login, si es false → redirige a /smartcard después del login
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
      profiles: true,
    },
    // intv (pmdw-1.in.tv.br) espera contraseña en claro; no hashear en cliente
    hashPasswordBeforeLogin: false,
    debug: {
      spatialNav: false,
      spatialNavVisual: false,
    },
  },
  {
    brand: "gigmax",
    appName: "Gigmax",
    drm: "https://cv10.panaccess.com/",
    token: "NLdLsrJkgIgnxMIDurSI",
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
    },
    hashPasswordBeforeLogin: true,
    debug: {
      spatialNav: false,
      spatialNavVisual: false,
    },
  },
];

export function getBrandConfig(brandName) {
  const brand = BRANDS.find(b => b.brand === brandName);
  return brand || null;
}

