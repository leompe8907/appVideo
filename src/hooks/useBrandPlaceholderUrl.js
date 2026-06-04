import { useMemo } from 'react';
import { useBrand } from '../contexts/BrandContext';

/** URL del placeholder de marca (`placeholder_220x160.png`). */
export function useBrandPlaceholderUrl() {
  const { currentBrand, getImage } = useBrand();
  return useMemo(
    () => currentBrand?.assets?.placeholder || getImage?.('placeholder_220x160.png') || '',
    [currentBrand?.assets?.placeholder, getImage],
  );
}
