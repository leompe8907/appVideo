import { useCallback, useEffect, useState } from 'react';
import { useBrandPlaceholderUrl } from '../../hooks/useBrandPlaceholderUrl';

/**
 * Imagen con fallback a `placeholder_220x160` de la marca si falta `src` o falla la carga.
 */
export function BrandFallbackImage({
  src,
  alt = '',
  className,
  placeholderClassName,
  loading,
  onError: onErrorProp,
}) {
  const placeholderUrl = useBrandPlaceholderUrl();
  const [imgSrc, setImgSrc] = useState(() => src || placeholderUrl || '');

  useEffect(() => {
    setImgSrc(src || placeholderUrl || '');
  }, [src, placeholderUrl]);

  const handleError = useCallback(
    (e) => {
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
    />
  );
}

export default BrandFallbackImage;
