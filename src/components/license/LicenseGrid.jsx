import { LicenseCard } from './LicenseCard';
import '../../styles/license/LicenseGrid.scss';

export function LicenseGrid({ licenses, onLicenseSelect, isSettingLicense }) {
  if (!licenses) return null;

  // Si es un array
  if (Array.isArray(licenses)) {
    if (licenses.length === 0) {
      return <p className="no-licenses">No se encontraron licencias.</p>;
    }
    return (
      <div className="licenses-grid">
        {licenses.map((license, index) => (
          <LicenseCard
            key={index}
            license={license}
            index={index}
            onSelect={() => onLicenseSelect(license)}
            isSettingLicense={isSettingLicense}
          />
        ))}
      </div>
    );
  }

  // Si es un objeto
  if (typeof licenses === 'object') {
    // Si tiene una propiedad que es array (ej: licenses: [...])
    const arrayKeys = Object.keys(licenses).filter(key => Array.isArray(licenses[key]));
    if (arrayKeys.length > 0) {
      const arrayKey = arrayKeys[0];
      const items = licenses[arrayKey];
      return (
        <div className="licenses-grid">
          {items.map((item, index) => (
            <LicenseCard
              key={index}
              license={item}
              index={index}
              title={`${arrayKey.charAt(0).toUpperCase() + arrayKey.slice(1)} #${index + 1}`}
              onSelect={() => onLicenseSelect(item)}
              isSettingLicense={isSettingLicense}
            />
          ))}
        </div>
      );
    }

    // Si es un objeto simple, mostrar sus propiedades
    return (
      <div className="licenses-grid">
        <LicenseCard
          license={licenses}
          index={0}
          title="Información de Licencias"
          onSelect={() => onLicenseSelect(licenses)}
          isSettingLicense={isSettingLicense}
          fullWidth
        />
      </div>
    );
  }

  // Fallback: mostrar como JSON
  return (
    <div className="licenses-grid">
      <LicenseCard
        license={licenses}
        index={0}
        title="Licencia"
        onSelect={() => onLicenseSelect(licenses)}
        isSettingLicense={isSettingLicense}
        fullWidth
        showJson
      />
    </div>
  );
}

export default LicenseGrid;

