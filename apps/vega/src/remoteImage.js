/**
 * Filtro de imágenes remotas. Los datos del operador traen URLs vacías, sin
 * id (`http://host//`) o que devuelven 404 / algo que no es imagen; en el
 * Fire TV una tormenta de esas fallas (p. ej. al rearmar el home al volver
 * del reproductor) terminaba cerrando la app. Una URL inválida no se pide, y
 * una que ya falló no se vuelve a pedir mientras la app está abierta.
 */
const failed = new Set();
const MAX_FAILED = 2000;

/** URL usable o null. */
export function usableImageUrl(url) {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  if (!/^https?:\/\/[^/]+\/./i.test(u)) return null; // sin esquema, sin host o sin ruta
  if (/\/$/.test(u)) return null; // termina en "/": falta el id de la imagen
  if (failed.has(u)) return null;
  return u;
}

/** `{uri}` para <Image> o `fallback` si la URL no sirve. */
export function imageSource(url, fallback = null) {
  const u = usableImageUrl(url);
  return u ? {uri: u} : fallback;
}

/** Registrar una URL que falló (desde onError). */
export function markImageFailed(source) {
  const u = typeof source === 'string' ? source : source?.uri;
  if (!u) return;
  if (failed.size >= MAX_FAILED) failed.clear();
  failed.add(u.trim());
}
