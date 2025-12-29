import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { useSpatialNavigation } from '../hooks/navigation/useSpatialNavigation';
import panaccessService from '../services/panaccessService';
import getUdid from '../api/cv/udid';
import '../styles/pages/_smartcard.scss';

// Función auxiliar para formatear las claves (camelCase a Title Case)
const formatKey = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

// Función auxiliar para renderizar el contenido de una licencia - minimalista
const renderLicenseContent = (data) => {
  if (!data || typeof data !== 'object') {
    return <p className="license-value">{String(data)}</p>;
  }

  // Limitar a los primeros 4 campos más importantes para diseño minimalista
  const entries = Object.entries(data).slice(0, 4);

  return (
    <div className="license-fields">
      {entries.map(([key, value]) => {
        // Formatear el valor de forma muy compacta
        let displayValue = '';
        if (value === null || value === undefined) {
          displayValue = '—';
        } else if (typeof value === 'object') {
          if (Array.isArray(value)) {
            displayValue = `${value.length}`;
          } else {
            const objKeys = Object.keys(value);
            displayValue = objKeys.length > 0 ? `${objKeys.length}` : '0';
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
};

export function SmartCardPage() {
  const navigate = useNavigate();
  const { currentBrand, getImage } = useBrand();
  const { isTV, deviceType } = useDevice();

  const [licenses, setLicenses] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSettingLicense, setIsSettingLicense] = useState(false);

  console.log(`🖥️ [SMARTCARD] Modo: ${isTV ? 'TV' : 'PC'}`);

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Obtener sessionId y udid del localStorage (unificado a sessionId)
        const sessionId = localStorage.getItem('sessionId');
        const udid = localStorage.getItem('udid') || getUdid();

        if (!sessionId) {
          throw new Error('No hay sesión activa. Por favor, inicia sesión.');
        }

        // Unificar: guardar solo en sessionId
        if (sessionId && !localStorage.getItem('sessionId')) {
          localStorage.setItem('sessionId', sessionId);
        }
        
        // Restaurar sessionId en el cliente CVClient si no está autenticado
        const client = panaccessService.getClient();
        if (client && !client.isAuthenticated()) {
          // Restaurar sessionId del localStorage al cliente
          client.sessionId = sessionId;
          console.log('[SMARTCARD] SessionId restaurado en el cliente');
        }

        // Llamar a getStreamingLicenses
        const response = await panaccessService.callAuthenticated('getStreamingLicenses', {
          sessionId: sessionId,
          udid: udid,
          withPins: true
        });

        console.log('[SMARTCARD] Respuesta getStreamingLicenses:', response);
        setLicenses(response);

      } catch (err) {
        console.error('[SMARTCARD] Error:', err);
        setError(err.message || 'Error al obtener licencias');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLicenses();
  }, []);

  // Obtener imagen de fondo del brand
  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  // Función para renderizar tarjetas según la estructura de datos
  const renderLicenseCards = () => {
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
        const items = licenses[arrayKey];
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
            title="Información de Licencias"
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
          title="Licencia"
          onSelect={() => handleLicenseSelect(licenses)}
          isSettingLicense={isSettingLicense}
          fullWidth
          showJson
        />
      </div>
    );
  };

  // Función para manejar la selección de una licencia
  const handleLicenseSelect = async (license) => {
    if (isSettingLicense) return;

    try {
      setIsSettingLicense(true);
      setError(null);

      // Obtener sessionId y udid del localStorage (unificado a sessionId)
      const sessionId = localStorage.getItem('sessionId');
      const udid = localStorage.getItem('udid') || getUdid();

      if (!sessionId) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      // Unificar: guardar solo en sessionId
      if (sessionId && !localStorage.getItem('sessionId')) {
        localStorage.setItem('sessionId', sessionId);
      }

      // Restaurar sessionId en el cliente CVClient si no está autenticado
      const client = panaccessService.getClient();
      if (client && !client.isAuthenticated()) {
        // Restaurar sessionId del localStorage al cliente
        client.sessionId = sessionId;
        console.log('[SMARTCARD] SessionId restaurado en el cliente');
      }

      // Extraer KEY y pin de la licencia
      // KEY puede estar en diferentes propiedades: key, KEY, licenseKey, etc.
      const licenseKey = license.KEY || license.key || license.licenseKey || license.Key || '';
      // pin puede estar en: pin, PIN, Pin, etc.
      const pin = license.pin || license.PIN || license.Pin || '';

      if (!licenseKey) {
        throw new Error('No se encontró la clave de licencia (KEY) en la tarjeta seleccionada.');
      }

      console.log('[SMARTCARD] Llamando setStreamingLicense:', {
        sessionId,
        udid,
        licenseKey,
        pin,
        failIfInUse:false
      });

      // Llamar a setStreamingLicense
      const response = await panaccessService.callAuthenticated('setStreamingLicense', {
        sessionId: sessionId,
        udid: udid,
        licenseKey: licenseKey,
        pin: pin,
        failIfInUse:false
      });

      console.log('[SMARTCARD] Respuesta setStreamingLicense:', response);

      // Aquí puedes agregar lógica adicional después de establecer la licencia
      // Por ejemplo, navegar a otra página o mostrar un mensaje de éxito
      
    } catch (err) {
      console.error('[SMARTCARD] Error al establecer licencia:', err);
      setError(err.message || 'Error al establecer la licencia');
    } finally {
      setIsSettingLicense(false);
    }
  };

  return (
    <div 
      className="smartcard-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
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
              onClick={() => navigate('/home')}
            >
              ← Volver al Inicio
            </button>
          </div>
        )}
        
        {!isLoading && !error && licenses && (
          <div className="smartcard-content">
            {isSettingLicense && (
              <div className="setting-license-overlay">
                <div className="loading-spinner"></div>
                <p className="loading-text">Estableciendo licencia...</p>
              </div>
            )}
            {renderLicenseCards()}
            <button
              className="back-button"
              onClick={() => navigate('/home')}
              disabled={isSettingLicense}
            >
              ← Volver al Inicio
            </button>
          </div>
        )}
        
        {!isLoading && !error && !licenses && (
          <div className="no-data-container">
            <p className="no-licenses">No se encontraron licencias.</p>
            <button
              className="back-button"
              onClick={() => navigate('/home')}
            >
              ← Volver al Inicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de tarjeta de licencia con navegación
function LicenseCard({ license, index, title, onSelect, isSettingLicense, fullWidth = false, showJson = false }) {
  const { isTV } = useDevice();

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

  // Renderizar contenido
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
      aria-label={`Seleccionar ${title || `licencia ${index + 1}`}`}
    >
      {renderContent()}
    </div>
  );
}

export default SmartCardPage;