/**
 * Página de SmartCard - Selección y activación de licencias
 * Refactorizada con componentes segmentados y servicio de activación
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import panaccessService from '../services/panaccessService';
import { useLicenseActivation } from '../hooks/useLicenseActivation';
import { extractLicenseKey, extractLicensePin } from '../utils/licenseUtils';
import { LicenseGrid } from '../components/license/LicenseGrid';
import { LicenseLoadingState } from '../components/license/LicenseLoadingState';
import { LicenseErrorState } from '../components/license/LicenseErrorState';
import { LicenseEmptyState } from '../components/license/LicenseEmptyState';
import { LicenseActivationOverlay } from '../components/license/LicenseActivationOverlay';
import '../styles/pages/_smartcard.scss';

export function SmartCardPage() {
  const navigate = useNavigate();
  const { currentBrand, getImage } = useBrand();
  const { isTV } = useDevice();
  const { activateLicense, isActivating, activationError } = useLicenseActivation();

  const [licenses, setLicenses] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log(`🖥️ [SMARTCARD] Modo: ${isTV ? 'TV' : 'PC'}`);

  useEffect(() => {
    fetchLicenses();
  }, []);

  /**
   * Obtiene las licencias del servidor
   */
  const fetchLicenses = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar que hay sesión activa
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }
      
      // Restaurar sessionId en el cliente CVClient si no está autenticado
      const client = panaccessService.getClient();
      if (client && !client.isAuthenticated()) {
        client.sessionId = sessionId;
        console.log('[SMARTCARD] SessionId restaurado en el cliente');
      }

      // Obtener licencias
      const response = await panaccessService.getStreamingLicenses();
      console.log('[SMARTCARD] Respuesta getStreamingLicenses:', response);
      setLicenses(response);

    } catch (err) {
      console.error('[SMARTCARD] Error:', err);
      setError(err.message || 'Error al obtener licencias');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Maneja la selección de una licencia
   */
  const handleLicenseSelect = async (license) => {
    if (isActivating) return;

    try {
      setError(null);

      // Verificar que hay sesión activa
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      // Restaurar sessionId en el cliente si es necesario
      const client = panaccessService.getClient();
      if (client && !client.isAuthenticated()) {
        client.sessionId = sessionId;
        console.log('[SMARTCARD] SessionId restaurado en el cliente');
      }

      // Extraer KEY y pin de la licencia
      const licenseKey = extractLicenseKey(license);
      const pin = extractLicensePin(license);

      if (!licenseKey) {
        throw new Error('No se encontró la clave de licencia (KEY) en la tarjeta seleccionada.');
      }

      console.log('[SMARTCARD] Activando licencia:', {
        licenseKey,
        pin,
        failIfInUse: false
      });

      // Activar licencia usando el hook
      await activateLicense(licenseKey, pin, false);

      console.log('[SMARTCARD] Licencia activada exitosamente');

      // Opcional: navegar a otra página después de activar
      // navigate('/home');

    } catch (err) {
      console.error('[SMARTCARD] Error al establecer licencia:', err);
      setError(err.message || 'Error al establecer la licencia');
    }
  };

  // Obtener imagen de fondo del brand
  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  return (
    <div 
      className="smartcard-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="smartcard-overlay"></div>
      
      <div className="smartcard-container">
        {/* Estado de carga */}
        {isLoading && <LicenseLoadingState />}
        
        {/* Estado de error */}
        {error && (
          <LicenseErrorState 
            error={error} 
            onRetry={fetchLicenses}
          />
        )}
        
        {/* Contenido principal */}
        {!isLoading && !error && licenses && (
          <div className="smartcard-content">
            {/* Overlay durante activación */}
            {isActivating && <LicenseActivationOverlay />}
            
            {/* Grilla de licencias */}
            <LicenseGrid
              licenses={licenses}
              onLicenseSelect={handleLicenseSelect}
              isSettingLicense={isActivating}
            />
            
            {/* Botón volver */}
            <button
              className="back-button"
              onClick={() => navigate('/home')}
              disabled={isActivating}
            >
              ← Volver al Inicio
            </button>
          </div>
        )}
        
        {/* Estado vacío */}
        {!isLoading && !error && !licenses && (
          <LicenseEmptyState />
        )}
      </div>
    </div>
  );
}

export default SmartCardPage;
