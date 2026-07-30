import { getBrandAsset } from '../utils/assetLoader';

/**
 * Avatares de perfil (pantalla "¿Quién está mirando?" / modal de creación).
 *
 * Antes este archivo era un array estático apuntando a un CDN remoto
 * compartido por las 6 marcas (`middleware.wind.do/public/images/<id>/...`).
 * Ahora son imágenes LOCALES POR MARCA, en `public/<marca>/avatars/1.png` a
 * `9.png`, resueltas con `getBrandAsset` (mismo mecanismo que logo.png /
 * background.png por marca) — cada marca puede tener su propio set de
 * avatares sin tocar código, solo reemplazando los archivos de su carpeta.
 *
 * Los `id` numéricos (87-95) se mantienen IGUALES a los de antes a propósito:
 * ese valor viaja a Panaccess vía `createProfile`/`setActiveProfile` y vuelve
 * en `getClientConfig().profiles[].imageId` — cambiarlos rompería la
 * asociación con cualquier perfil que ya se haya creado en el backend con el
 * esquema viejo.
 */
const AVATAR_FILENAMES = {
  87: 'avatars/1.png',
  88: 'avatars/2.png',
  89: 'avatars/3.png',
  90: 'avatars/4.png',
  91: 'avatars/5.png',
  92: 'avatars/6.png',
  93: 'avatars/7.png',
  94: 'avatars/8.png',
  95: 'avatars/9.png',
};

/**
 * Devuelve la lista de avatares disponibles para perfiles, resueltos con los
 * assets de la marca indicada.
 * @param {string} [brand] - `currentBrand.brand` (ver `useBrand()`). Si no se
 *   pasa, `getBrandAsset` cae a `getSharedAsset` (carpeta `public/shared/`).
 * @returns {Array<{ id: number, img: string }>}
 */
export function getProfileAvatars(brand) {
  return Object.entries(AVATAR_FILENAMES).map(([id, filename]) => ({
    id: Number(id),
    img: getBrandAsset(brand, filename),
  }));
}

export default getProfileAvatars;
