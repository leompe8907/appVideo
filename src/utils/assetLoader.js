/**
 * Helper para cargar assets dinámicos según la marca activa
 */

/**
 * Obtiene la ruta de un asset de la marca actual
 * @param {string} brand - Nombre de la marca
 * @param {string} path - Ruta relativa del asset (ej: 'logo.png', 'images/bg.jpg')
 * @returns {string} Ruta completa del asset
 */
export function getBrandAsset(brand, path) {
  return `/${brand}/${path}`;
}

/**
 * Obtiene la ruta de un asset compartido
 * @param {string} path - Ruta relativa del asset
 * @returns {string} Ruta completa del asset
 */
export function getSharedAsset(path) {
  return `/shared/${path}`;
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

