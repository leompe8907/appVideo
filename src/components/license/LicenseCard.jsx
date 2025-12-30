import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import { formatKey } from '../../utils/licenseUtils';
import '../../styles/license/LicenseCard.scss';

export function LicenseCard({ 
  license, 
  index, 
  title, 
  onSelect, 
  isSettingLicense, 
  fullWidth = false, 
  showJson = false 
}) {
  const { isTV } = useDevice();

  const handleEnterPress = () => {
    if (!isSettingLicense) {
      onSelect();
    }
  };

  const { ref, focused } = useSpatialNavigation({
    onEnterPress: handleEnterPress,
    focusKey: `license-card-${index}`,
    isFocusable: !isSettingLicense,
  });

  const handleClick = () => {
    if (!isTV && !isSettingLicense) {
      onSelect();
    }
  };

  const handleKeyDown = (e) => {
    if (!isTV && !isSettingLicense) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnterPress();
      }
    }
  };

  const renderContent = () => {
    if (showJson) {
      return (
        <div className="license-card-body">
          <pre className="license-json">{JSON.stringify(license, null, 2)}</pre>
        </div>
      );
    }

    return (
      <>
        <div className="license-card-header">
          <h3>{title || `Licencia #${index + 1}`}</h3>
        </div>
        <div className="license-card-body">
          {renderLicenseContent(license)}
        </div>
      </>
    );
  };

  const cardClasses = [
    'license-card',
    fullWidth ? 'license-card-full' : '',
    focused ? 'focused' : '',
    isSettingLicense ? 'disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isTV ? -1 : 0}
      role="button"
      aria-label={`Seleccionar ${title || `licencia ${index + 1}`}`}
    >
      {renderContent()}
    </div>
  );
}

/**
 * Renderiza el contenido de una licencia
 */
function renderLicenseContent(data) {
  if (!data || typeof data !== 'object') {
    return <p className="license-value">{String(data)}</p>;
  }

  // Limitar a los primeros 4 campos más importantes
  const entries = Object.entries(data).slice(0, 4);

  return (
    <div className="license-fields">
      {entries.map(([key, value]) => {
        let displayValue = '';
        if (value === null || value === undefined) {
          displayValue = '—';
        } else if (typeof value === 'object') {
          if (Array.isArray(value)) {
            displayValue = `${value.length} items`;
          } else {
            const objKeys = Object.keys(value);
            displayValue = objKeys.length > 0 ? `${objKeys.length} campos` : '0';
          }
        } else {
          const str = String(value);
          displayValue = str.length > 20 ? str.substring(0, 20) + '...' : str;
        }

        return (
          <div key={key} className="license-field">
            <span className="license-label">{formatKey(key)}</span>
            <span className="license-value">{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
}

export default LicenseCard;

