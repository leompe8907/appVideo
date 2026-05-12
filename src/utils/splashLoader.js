/**
 * Helper para cargar imagen/video de splash según configuración
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
    return getBrandAsset(brand, 'splash.gif');
  } else {
    return getBrandAsset(brand, 'splash.png');
  }
}

/**
 * Obtiene la ruta del video de splash si está configurado.
 * @param {string} brand - Nombre de la marca
 * @param {string|boolean} splashVideo - Nombre del archivo de video (ej: 'splash.mp4') o true para usar 'splash.mp4' por defecto
 * @returns {string|null} Ruta del video o null si no aplica
 */
export function getSplashVideoPath(brand, splashVideo) {
  if (!splashVideo) return null;
  const filename = typeof splashVideo === 'string' ? splashVideo : 'splash.mp4';
  return getBrandAsset(brand, filename);
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

