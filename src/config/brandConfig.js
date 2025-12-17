import { getBrandConfig } from "./brands";
import { DEFAULT_BRAND } from "./defaultBrand";
import { getBrandAsset } from "../utils/assetLoader";

/**
 * Obtiene la configuración activa de la marca
 * Prioridad: URL param > Default Brand > Primera marca
 */
export function getActiveBrandConfig() {
  // 1. Intentar obtener del query param ?brand=xxx
  const urlParams = new URLSearchParams(window.location.search);
  const brandFromUrl = urlParams.get("brand");
  
  if (brandFromUrl) {
    const config = getBrandConfig(brandFromUrl);
    if (config) {
      console.log(`[Brand] Cargado desde URL: ${brandFromUrl}`);
      return enrichConfigWithAssets(config);
    }
    console.warn(`[Brand] No encontrado en URL: ${brandFromUrl}`);
  }

  // 2. Usar marca por defecto del build
  if (DEFAULT_BRAND) {
    const config = getBrandConfig(DEFAULT_BRAND);
    if (config) {
      console.log(`[Brand] Cargado por defecto: ${DEFAULT_BRAND}`);
      return enrichConfigWithAssets(config);
    }
  }

  // 3. Fallback a la primera marca disponible
  const config = getBrandConfig("telecable");
  console.warn("[Brand] Usando fallback: telecable");
  return enrichConfigWithAssets(config);
}

/**
 * Enriquece la configuración con rutas de assets
 */
function enrichConfigWithAssets(config) {
  if (!config) return null;
  
  return {
    ...config,
    assets: {
      logo: getBrandAsset(config.brand, 'logo.png'),
      logoWhite: getBrandAsset(config.brand, 'logo-white.png'),
      background: getBrandAsset(config.brand, 'background.jpg'),
      favicon: getBrandAsset(config.brand, 'favicon.ico'),
      splash: getBrandAsset(config.brand, 'splash.jpg'),
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

