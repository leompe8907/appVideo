/**
 * Utilidades para responsive design y escalado automático
 */

/**
 * Calcula el tamaño escalado basado en la resolución base (1920px)
 * @param {number} baseSize - Tamaño base en píxeles (para Full HD)
 * @param {number} viewportWidth - Ancho actual del viewport
 * @returns {number} Tamaño escalado
 */
export function scaleSize(baseSize, viewportWidth = window.innerWidth) {
  const baseWidth = 1920; // Full HD como base
  return (baseSize * viewportWidth) / baseWidth;
}

/**
 * Obtiene el breakpoint actual
 * @param {number} width - Ancho del viewport
 * @returns {string} Nombre del breakpoint
 */
export function getBreakpoint(width = window.innerWidth) {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1280) return 'desktop';
  if (width < 1920) return 'hd';
  if (width < 2560) return 'fullhd';
  if (width < 3840) return 'ultrahd';
  if (width < 7680) return '4k';
  return '8k';
}

/**
 * Convierte píxeles a unidades viewport (vw)
 * @param {number} px - Píxeles
 * @param {number} baseWidth - Ancho base (default: 1920)
 * @returns {string} Valor en vw
 */
export function pxToVw(px, baseWidth = 1920) {
  return `${(px / baseWidth) * 100}vw`;
}

/**
 * Convierte píxeles a unidades viewport height (vh)
 * @param {number} px - Píxeles
 * @param {number} baseHeight - Alto base (default: 1080)
 * @returns {string} Valor en vh
 */
export function pxToVh(px, baseHeight = 1080) {
  return `${(px / baseHeight) * 100}vh`;
}

/**
 * Obtiene el factor de escala recomendado
 * @param {number} width - Ancho del viewport
 * @returns {number} Factor de escala
 */
export function getScaleFactor(width = window.innerWidth) {
  const baseWidth = 1920;
  return width / baseWidth;
}

