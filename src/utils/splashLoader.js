/**
 * Helper para cargar imagen de splash según configuración
 */

import { getBrandAsset } from './assetLoader';

/**
 * Obtiene la ruta del splash según si es animado o no
 * @param {string} brand - Nombre de la marca
 * @param {boolean} splashAnimado - Si es true busca .gif, si es false busca .png/.webp/.jpg
 * @returns {string} Ruta del splash
 */
export function getSplashPath(brand, splashAnimado) {
  if (splashAnimado === true) {
    // Si es animado, buscar .gif
    return getBrandAsset(brand, 'splash.gif');
  } else {
    // Si no es animado, intentar en orden: .png, .webp, .jpg
    // Por defecto usar .png (el más común)
    return getBrandAsset(brand, 'splash.png');
  }
}

/**
 * Obtiene múltiples rutas posibles para fallback
 * @param {string} brand - Nombre de la marca
 * @param {boolean} splashAnimado - Si es true solo busca .gif
 * @returns {string[]} Array de rutas posibles
 */
export function getSplashFallbackPaths(brand, splashAnimado) {
  if (splashAnimado === true) {
    return [getBrandAsset(brand, 'splash.gif')];
  } else {
    return [
      getBrandAsset(brand, 'splash.png'),
      getBrandAsset(brand, 'splash.webp'),
      getBrandAsset(brand, 'splash.jpg'),
      getBrandAsset(brand, 'splash.jpeg'),
    ];
  }
}

