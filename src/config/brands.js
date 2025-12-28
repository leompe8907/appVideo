export const BRANDS = [
  {
    brand: "bromteck",
    appName: "Bromteck",
    drm: 'https://cv01.panaccess.com/',
    token: 'gQposTlrMIOYQVdYBNYC',
    developedBy: "Network Broadcast",
    version: "1.0.2",
    splashDuration: 3000, // Duración en milisegundos
    splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
    
    // Configuración de UI/Tema
    ui: {
      logoPositionHome: "top",
      showTime: true,
      epgLineColorTime: "#2CE308",
      primaryColor: "#2CE308",
      secondaryColor: "#1a8a05",
      theme: "dark",
      fontFamily: "Arial, sans-serif",
    },
        
    // Límites y restricciones
    limits: {
      maxProfiles: 5,
      maxDownloads: 10,
      concurrentStreams: 2,
      recordingMaxDuration: 120, // minutos
      watchlistMaxItems: 100,
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true,
      chat: true,
      recording: true,
      pip: false,
      chromecast: true,
      downloads: false,
      profiles: true,
      parentalControl: true,
      watchlist: true,
      recommendations: true,
    },
    
    // Configuración de debug para navegación espacial
    debug: {
      spatialNav: false,        // Logs en consola (default: solo en DEV)
      spatialNavVisual: false,  // Debug visual (marcos rojos) (default: false)
    },
  },
  {
    brand: "intv",
    appName: "inTV Play",
    drm: "https://pmdw-1.in.tv.br/",
    token: "CQSepFFsoFNgyLNDYOpz",
    developedBy: "inTV&#174,",
    version: "2.0.2",
    splashDuration: 3000, // Duración en milisegundos
    splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
    
    // Configuración de UI/Tema
    ui: {
      logoPositionHome: "right",
      showTime: false,
      epgLineColorTime: "#3333FF",
      primaryColor: "#3333FF",
      secondaryColor: "#1a1aaa",
      theme: "light",
      fontFamily: "Roboto, sans-serif",
    },
    
    // Límites y restricciones
    limits: {
      maxProfiles: 7,
      maxDownloads: 20,
      concurrentStreams: 3,
      recordingMaxDuration: 180,
      watchlistMaxItems: 200,
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true,
      chat: false,
      recording: true,
      pip: true,
      chromecast: true,
      downloads: true,
      profiles: true,
      parentalControl: true,
      watchlist: true,
      recommendations: true,
    },
    
    // Configuración de debug para navegación espacial
    debug: {
      spatialNav: false,        // Logs en consola (default: solo en DEV)
      spatialNavVisual: false,  // Debug visual (marcos rojos) (default: false)
    },
  },
  {
    brand: "gigmax",
    appName: "Gigmax",
    drm: "https://cv10.panaccess.com/",
    token: "NLdLsrJkgIgnxMIDurSI",
    developedBy: "Gigmax",
    version: "2.0.3",
    splashDuration: 3000, // Duración en milisegundos
    splashAnimado: false, // Si es true busca .gif, si es false busca .png/.webp/.jpg
    
    // Configuración de UI/Tema
    ui: {
      logoPositionHome: "right",
      showTime: true,
      epgLineColorTime: "#2CE308",
      primaryColor: "#FF6B35",
      secondaryColor: "#cc5528",
      theme: "dark",
      fontFamily: "Montserrat, sans-serif",
    },
    
    // Límites y restricciones
    limits: {
      maxProfiles: 10,
      maxDownloads: 15,
      concurrentStreams: 4,
      recordingMaxDuration: 240,
      watchlistMaxItems: 150,
    },
    
    // Features habilitadas/deshabilitadas
    features: {
      miniPlayer: true,
      chat: true,
      recording: true,
      pip: true,
      chromecast: true,
      downloads: false,
      profiles: true,
      parentalControl: false,
      watchlist: true,
      recommendations: true,
    },
    
    // Configuración de debug para navegación espacial
    debug: {
      spatialNav: false,        // Logs en consola (default: solo en DEV)
      spatialNavVisual: false,  // Debug visual (marcos rojos) (default: false)
    },
  },
];

export function getBrandConfig(brandName) {
  const brand = BRANDS.find(b => b.brand === brandName);
  return brand || null;
}

