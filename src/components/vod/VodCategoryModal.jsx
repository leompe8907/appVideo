/**
 * Modal con todas las películas/series de un género. Se abre al pulsar "Ver más" en la fila.
 */

import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableButton } from '../navigation/FocusableButton';
import VodCard from './VodCard';
import AppIcon from '../AppIcon';

export function VodCategoryModal({ categoryName, vods = [], onSelectItem, onClose }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { isTV } = useDevice();
  const baseUrl = currentBrand?.drm || '';

  return (
    <div className="vod-category-overlay" role="dialog" aria-modal="true" aria-labelledby="vod-category-modal-title">
      <div className="vod-category-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="vod-category-modal">
        <div className="vod-category-header">
          <h2 id="vod-category-modal-title" className="vod-category-title">{categoryName}</h2>
          <FocusableButton
            type="button"
            className="vod-category-close"
            id="vod-category-close-tv"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            {isTV ? (
              t('common.close', { defaultValue: 'Cerrar' })
            ) : (
              <AppIcon name="close" size={18} />
            )}
          </FocusableButton>
        </div>
        <div className="vod-category-grid">
          {vods.map((v, i) => (
            <VodCard
              key={v.id ?? i}
              item={v}
              onSelect={() => onSelectItem?.(v)}
              baseUrl={baseUrl}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default VodCategoryModal;
