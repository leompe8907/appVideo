import { useCallback, useEffect, useState } from 'react';
import { useBrandPlaceholderUrl } from '../../hooks/useBrandPlaceholderUrl';
import { usableImageUrl, markImageFailed } from '@appvideo/core/utils/remoteImage';

const IMG_OPTS = { allowRelative: true };

/**
 * Imagen con fallback a `placeholder_220x160` de la marca si falta `src` o falla la carga.
 * Una `src` rota (vacía, sin id, o que ya falló antes) no se pide: va directo al
 * placeholder (ver @appvideo/core/utils/remoteImage).
 */
export function BrandFallbackImage({
  src,
  alt = '',
  className,
  placeholderClassName,
  loading,
  onError: onErrorProp,
  onLoad: onLoadProp,
}) {
  const placeholderUrl = useBrandPlaceholderUrl();
  const [imgSrc, setImgSrc] = useState(() => usableImageUrl(src, IMG_OPTS) || placeholderUrl || '');

  useEffect(() => {
    setImgSrc(usableImageUrl(src, IMG_OPTS) || placeholderUrl || '');
  }, [src, placeholderUrl]);

  const handleError = useCallback(
    (e) => {
      if (imgSrc && imgSrc !== placeholderUrl) markImageFailed(imgSrc);
      if (onErrorProp) {
        onErrorProp(e);
        return;
      }
      if (placeholderUrl && imgSrc !== placeholderUrl) {
        setImgSrc(placeholderUrl);
      } else {
        setImgSrc('');
      }
    },
    [placeholderUrl, imgSrc, onErrorProp],
  );

  if (!imgSrc) {
    if (placeholderClassName) {
      return <div className={placeholderClassName} aria-hidden="true" />;
    }
    return null;
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleError}
      onLoad={onLoadProp}
    />
  );
}

export default BrandFallbackImage;
