import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { useSpatialNavigation } from '../hooks/navigation/useSpatialNavigation';
import { MessageModal } from '../components/MessageModal';
import panaccessService from '../services/panaccessService';
import { setLoggedOut } from '../utils/userSession';
import '../styles/pages/_smartcard.scss';

// Normaliza la estructura de una licencia a los campos clave para la UI
const normalizeLicense = (license) => {
  if (!license || typeof license !== 'object') {
    return { key: '', pin: '', active: false, products: '' };
  }

  const key =
    license.KEY ||
    license.key ||
    license.licenseKey ||
    license.Key ||
    '';

  const pin = license.pin || license.PIN || license.Pin || '';
  const active = license.active === true;
  const products =
    typeof license.products === 'string' ? license.products : '';

  return { key, pin, active, products };
};

export function SmartCardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, getImage } = useBrand();
  const { isTV, deviceType } = useDevice();

  const [licenses, setLicenses] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultModal, setResultModal] = useState(null);
  const [isSettingLicense, setIsSettingLicense] = useState(false);

  console.log(`🖥️ [SMARTCARD] Modo: ${isTV ? 'TV' : 'PC'}`);

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await panaccessService.getStreamingLicenses({ withPins: true });

        console.log('[SMARTCARD] Respuesta getStreamingLicenses:', response);
        setLicenses(response);
      } catch (err) {
        console.error('[SMARTCARD] Error:', err);
        setError(err.message || t('smartcard.errorFetch'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLicenses();
  }, [t]);

  // Obtener imagen de fondo del brand
  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  // Función para renderizar tarjetas según la estructura de datos
  const renderLicenseCards = () => {
    if (!licenses) return null;

    // Si es un array
    if (Array.isArray(licenses)) {
      const validLicenses = licenses
        .map((license) => ({ raw: license, norm: normalizeLicense(license) }))
        .filter(({ norm }) => norm.key && String(norm.key).trim().length > 0)
        // Ordenar: primero activas, luego por clave para consistencia
        .sort((a, b) => {
          if (a.norm.active === b.norm.active) {
            return String(a.norm.key).localeCompare(String(b.norm.key));
          }
          return a.norm.active ? -1 : 1;
        })
        .map(({ raw }) => raw);

      if (validLicenses.length === 0) {
        return <p className="no-licenses">{t('smartcard.noLicenses')}</p>;
      }
      return (
        <div className="licenses-grid">
          {validLicenses.map((license, index) => (
            <LicenseCard
              key={index}
              license={license}
              index={index}
              onSelect={() => handleLicenseSelect(license)}
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
        const items = licenses[arrayKey]
          .map((item) => ({ raw: item, norm: normalizeLicense(item) }))
          .filter(({ norm }) => norm.key && String(norm.key).trim().length > 0)
          .sort((a, b) => {
            if (a.norm.active === b.norm.active) {
              return String(a.norm.key).localeCompare(String(b.norm.key));
            }
            return a.norm.active ? -1 : 1;
          })
          .map(({ raw }) => raw);

        if (items.length === 0) {
          return <p className="no-licenses">{t('smartcard.noLicenses')}</p>;
        }
        return (
          <div className="licenses-grid">
            {items.map((item, index) => (
              <LicenseCard
                key={index}
                license={item}
                index={index}
                title={`${arrayKey.charAt(0).toUpperCase() + arrayKey.slice(1)} #${index + 1}`}
                onSelect={() => handleLicenseSelect(item)}
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
            title={t('smartcard.licenseInfo')}
            onSelect={() => handleLicenseSelect(licenses)}
            isSettingLicense={isSettingLicense}
            fullWidth
          />
        </div>
      );
    }

    // Fallback: mostrar como texto
    return (
      <div className="licenses-grid">
        <LicenseCard
          license={licenses}
          index={0}
          title={t('smartcard.license')}
          onSelect={() => handleLicenseSelect(licenses)}
          isSettingLicense={isSettingLicense}
          fullWidth
          showJson
        />
      </div>
    );
  };

  // Cerrar sesión y volver a login
  const handleBack = () => {
    panaccessService.logout();
    setLoggedOut();
    navigate('/login');
  };

  // Función para manejar la selección de una licencia
  const handleLicenseSelect = async (license) => {
    if (isSettingLicense) return;

    try {
      setIsSettingLicense(true);
      setError(null);
      setResultModal(null);

      const licenseKey = license.KEY || license.key || license.licenseKey || license.Key || '';
      const pin = license.pin || license.PIN || license.Pin || '';

      if (!licenseKey) {
        throw new Error(t('smartcard.errorNoKey'));
      }

      // Primera activación: forzar failIfInUse=true (mismo comportamiento que el proyecto EPG).
      await panaccessService.setStreamingLicense({ licenseKey, pin, failIfInUse: true });

      console.log('[SMARTCARD] setStreamingLicense: éxito');
      setResultModal({ type: 'success', text: t('smartcard.success') });
    } catch (err) {
      console.error('[SMARTCARD] Error al establecer licencia:', err);
      setResultModal({ type: 'error', text: err?.errorInfo?.userMessage || err?.message || t('smartcard.errorSet') });
    } finally {
      setIsSettingLicense(false);
    }
  };

  return (
    <div 
      className="smartcard-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      {resultModal && (
        <MessageModal
          type={resultModal.type}
          message={resultModal.text}
          onClose={() => {
            const wasSuccess = resultModal.type === 'success';
            setResultModal(null);
            if (wasSuccess) navigate('/bouquets');
          }}
        />
      )}
      <div className="smartcard-overlay"></div>
      
      <div className="smartcard-container">
        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Cargando licencias...</p>
          </div>
        )}
        
        {error && (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <p className="error-text">{error}</p>
            <button
              className="back-button"
              onClick={handleBack}
            >
              {t('common.backLogout')}
            </button>
          </div>
        )}
        
        {!isLoading && !error && licenses && (
          <div className="smartcard-content">
            {isSettingLicense && (
              <div className="setting-license-overlay">
                <div className="loading-spinner"></div>
                <p className="loading-text">{t('smartcard.settingLicense')}</p>
              </div>
            )}
            {renderLicenseCards()}
            <button
              className="back-button"
              onClick={handleBack}
              disabled={isSettingLicense}
            >
              {t('common.backLogout')}
            </button>
          </div>
        )}
        
        {!isLoading && !error && !licenses && (
          <div className="no-data-container">
            <p className="no-licenses">{t('smartcard.noLicenses')}</p>
            <button
              className="back-button"
              onClick={handleBack}
            >
              {t('common.backLogout')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de tarjeta de licencia con navegación
function LicenseCard({ license, index, title, onSelect, isSettingLicense, fullWidth = false, showJson = false }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const titleText = title || t('smartcard.licenseNumber', { index: index + 1 });
  const ariaLabel = t('smartcard.selectLicense', { title: titleText });
  const normalized = normalizeLicense(license);

  // Handler para cuando se presiona Enter/OK
  const handleEnterPress = () => {
    if (!isSettingLicense) {
      onSelect();
    }
  };

  // Usar el hook de navegación espacial
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: handleEnterPress,
    focusKey: `license-card-${index}`,
    isFocusable: !isSettingLicense,
  });

  // Handler para click (solo en PC)
  const handleClick = () => {
    if (!isTV && !isSettingLicense) {
      onSelect();
    }
  };

  // Handler para teclado nativo (solo en PC)
  const handleKeyDown = (e) => {
    if (!isTV && !isSettingLicense) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnterPress();
      }
    }
  };

  // Renderizar contenido optimizado para selección de smartcard
  const renderContent = () => {
    if (showJson) {
      return (
        <div className="license-card-body">
          <pre className="license-json">{JSON.stringify(license, null, 2)}</pre>
        </div>
      );
    }

    const { key, active, products } = normalized;
    const truncatedProducts =
      products && products.length > 80
        ? `${products.slice(0, 80)}…`
        : products;

    return (
      <>
        <div className="license-card-header">
          <h3>{titleText}</h3>
          <span className={`license-status ${active ? 'active' : 'inactive'}`}>
            {active ? t('smartcard.statusActive') : t('smartcard.statusInactive')}
          </span>
        </div>
        <div className="license-card-body">
          <div className="license-row">
            <span className="license-label">{t('smartcard.fieldKey')}</span>
            <span className="license-value code">{key || '—'}</span>
          </div>
          {truncatedProducts && (
            <div className="license-row">
              <span className="license-label">{t('smartcard.fieldProducts')}</span>
              <span className="license-value">{truncatedProducts}</span>
            </div>
          )}
        </div>
      </>
    );
  };

  // Construir clases CSS
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
      aria-label={ariaLabel}
    >
      {renderContent()}
      <div className="license-card-footer">
        <button
          type="button"
          className="license-select-button"
          disabled={isSettingLicense}
        >
          {t('smartcard.useThisCard')}
        </button>
      </div>
    </div>
  );
}

export default SmartCardPage;