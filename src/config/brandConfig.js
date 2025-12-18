import { getBrandConfig } from "./brands";
import { DEFAULT_BRAND } from "./defaultBrand";
import { getBrandAsset } from "../utils/assetLoader";
import { getSplashPath } from "../utils/splashLoader";

/**
 * Obtiene la configuración activa de la marca
 * Prioridad: URL param > localStorage > Default Brand > Primera marca
 */
export function getActiveBrandConfig() {
  // 1. Intentar obtener del query param ?brand=xxx (máxima prioridad)
  const urlParams = new URLSearchParams(window.location.search);
  const brandFromUrl = urlParams.get("brand");
  
  if (brandFromUrl) {
    const config = getBrandConfig(brandFromUrl);
    if (config) {
      console.log(`[Brand] Cargado desde URL: ${brandFromUrl}`);
      // Guardar en localStorage para persistencia
      localStorage.setItem('brand', brandFromUrl);
      return enrichConfigWithAssets(config);
    }
    console.warn(`[Brand] No encontrado en URL: ${brandFromUrl}`);
  }

  // 2. Intentar obtener del localStorage (persistencia entre sesiones)
  const brandFromStorage = localStorage.getItem('brand');
  if (brandFromStorage) {
    const config = getBrandConfig(brandFromStorage);
    if (config) {
      console.log(`[Brand] Cargado desde localStorage: ${brandFromStorage}`);
      return enrichConfigWithAssets(config);
    }
    // Si el brand en localStorage no existe, limpiarlo
    console.warn(`[Brand] Brand en localStorage inválido: ${brandFromStorage}`);
    localStorage.removeItem('brand');
  }

  // 3. Usar marca por defecto del build
  if (DEFAULT_BRAND) {
    const config = getBrandConfig(DEFAULT_BRAND);
    if (config) {
      console.log(`[Brand] Cargado por defecto: ${DEFAULT_BRAND}`);
      // Guardar en localStorage para persistencia
      localStorage.setItem('brand', DEFAULT_BRAND);
      return enrichConfigWithAssets(config);
    }
  }

  // 4. Fallback a la primera marca disponible
  const config = getBrandConfig("bromteck");
  console.warn("[Brand] Usando fallback: bromteck");
  // Guardar en localStorage para persistencia
  localStorage.setItem('brand', 'bromteck');
  return enrichConfigWithAssets(config);
}

/**
 * Enriquece la configuración con rutas de assets
 */
function enrichConfigWithAssets(config) {
  if (!config) return null;
  
  // Determinar ruta de splash según splashAnimado (puede estar en ui o en raíz)
  const splashAnimado = config.ui?.splashAnimado === true || config.splashAnimado === true;
  const splashPath = getSplashPath(config.brand, splashAnimado);
  
  return {
    ...config,
    assets: {
      logo: getBrandAsset(config.brand, 'logo.png'),
      logoWhite: getBrandAsset(config.brand, 'logo-white.png'),
      logoTop: getBrandAsset(config.brand, 'logo-top.png'),
      logoBlack: getBrandAsset(config.brand, 'logo_black.png'),
      background: getBrandAsset(config.brand, 'background.png'),
      favicon: getBrandAsset(config.brand, 'favicon.ico'),
      splash: splashPath,
      placeholder: getBrandAsset(config.brand, 'placeholder_220x160.png'),
      // Helper para obtener cualquier asset custom
      get: (path) => getBrandAsset(config.brand, path),
    }
  };
}

/**
 * Hook para React (opcional)
 */
export function useBrandConfig() {
  return getActiveBrandConfig();
}

