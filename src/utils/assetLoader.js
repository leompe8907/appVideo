/**
 * Helper para cargar assets dinámicos según la marca activa
 */

// Base pública que Vite inyecta según `base` en vite.config.js
const BASE = import.meta.env.BASE_URL || '/';

// Quita posibles / iniciales para no romper concatenación
const normalize = (s) => s.replace(/^\/+/, '');

/**
 * Obtiene la ruta de un asset de la marca actual
 * @param {string} brand - Nombre de la marca
 * @param {string} path - Ruta relativa del asset (ej: 'logo.png', 'images/bg.jpg')
 * @returns {string} Ruta completa del asset
 */
export function getBrandAsset(brand, path) {
  if (!brand || !path) {
    return getSharedAsset(path || 'logo.png');
  }
  return `${BASE}${normalize(brand)}/${normalize(path)}`;
}

/**
 * Obtiene la ruta de un asset compartido
 * @param {string} path - Ruta relativa del asset
 * @returns {string} Ruta completa del asset
 */
export function getSharedAsset(path) {
  if (!path) return `${BASE}shared/logo.png`;
  return `${BASE}shared/${normalize(path)}`;
}

/**
 * Obtiene la ruta de una imagen con fallback a múltiples extensiones
 * @param {string} brand - Nombre de la marca
 * @param {string} imageName - Nombre base de la imagen (sin extensión o con extensión)
 * @returns {string} Ruta de la imagen
 */
export function getBrandImageWithFallback(brand, imageName) {
  if (!brand || !imageName) {
    return getSharedAsset(imageName || 'logo.png');
  }

  // Si ya tiene extensión, usar directamente
  if (imageName.includes('.')) {
    return getBrandAsset(brand, imageName);
  }

  // Si no tiene extensión, intentar con extensiones comunes
  // Por simplicidad devolvemos la .png, el navegador manejará el fallback con onError
  return getBrandAsset(brand, `${imageName}.png`);
}

/**
 * Precarga una imagen
 * @param {string} src - Ruta de la imagen
 * @returns {Promise<HTMLImageElement>}
 */
export function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Precarga múltiples assets de una marca
 * @param {string} brand - Nombre de la marca
 * @param {string[]} paths - Array de rutas relativas
 * @returns {Promise<HTMLImageElement[]>}
 */
export function preloadBrandAssets(brand, paths) {
  const promises = paths.map(path => preloadImage(getBrandAsset(brand, path)));
  return Promise.all(promises);
}

