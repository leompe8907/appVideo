/**
 * Filtro de imágenes remotas: la lógica vive en @appvideo/core (compartida con
 * web / LG / Samsung). Aquí solo el helper `{uri}` para <Image> de RN.
 */
import {usableImageUrl, markImageFailed} from '@appvideo/core/utils/remoteImage';

export {usableImageUrl, markImageFailed};

/** `{uri}` para <Image> o `fallback` si la URL no sirve. */
export function imageSource(url, fallback = null) {
  const u = usableImageUrl(url);
  return u ? {uri: u} : fallback;
}
