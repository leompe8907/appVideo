/**
 * Ya no se usa proxy de imágenes en este proyecto.
 * Se mantiene la utilidad por compatibilidad: retorna la URL original.
 */
export function proxyImageUrl(inputUrl, opts = {}) {
  void opts;
  return inputUrl;
}

