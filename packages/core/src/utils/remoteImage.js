/**
 * Filtro de imágenes remotas (compartido web / LG / Samsung / Fire TV).
 *
 * Los datos del operador traen URLs vacías, sin id (`http://host//`) o que
 * devuelven 404 / algo que no es imagen. Con ~200 canales cada una de esas
 * fallas es un pedido de red perdido, y se repite cada vez que la tarjeta se
 * vuelve a montar (al navegar, al volver del reproductor). En el Fire TV una
 * tormenta de esas fallas terminaba cerrando la app; en los TV web hace lenta
 * la navegación. Una URL inválida no se pide, y una que ya falló no se vuelve
 * a pedir mientras la app está abierta.
 */
const failed = new Set();
const MAX_FAILED = 2000;

/**
 * URL usable o null.
 * @param {unknown} url
 * @param {{ allowRelative?: boolean }} [opts] - `allowRelative`: acepta rutas
 *   del mismo origen (`/cdn/...`, web). En Fire TV no sirven: no hay origen.
 */
export function usableImageUrl(url, { allowRelative = false } = {}) {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (/^(data|blob):/i.test(u)) return u;
  if (/^https?:/i.test(u)) {
    if (!/^https?:\/\/[^/]+\/./i.test(u)) return null; // sin host o sin ruta
  } else if (!allowRelative || !/^\/[^/]/.test(u)) {
    return null;
  }
  if (/\/$/.test(u)) return null; // termina en "/": falta el id de la imagen
  if (failed.has(u)) return null;
  return u;
}

/** Registrar una URL que falló (desde onError). Acepta string o `{uri}`. */
export function markImageFailed(source) {
  const u = typeof source === 'string' ? source : source?.uri;
  if (!u) return;
  if (failed.size >= MAX_FAILED) failed.clear();
  failed.add(u.trim());
}

/** ¿Ya falló esta URL? */
export function hasImageFailed(url) {
  return typeof url === 'string' && failed.has(url.trim());
}

/** Solo para tests. */
export function resetFailedImages() {
  failed.clear();
}
