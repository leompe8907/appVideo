import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { getInitialRoute } from '../utils/navigation';
import panaccessService from '../services/panaccessService';
import { loginAndActivateLicense } from '../services/loginFlow';
import * as userSession from '../utils/userSession';
import '../styles/components/_splash.scss';

export function SplashPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, splashDuration, isLoading, getImage, appName } = useBrand();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!currentBrand) {
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    const run = async () => {
      try {
        if (!panaccessService.client) {
          await panaccessService.initialize(currentBrand);
        }

        if (userSession.getSessionId()) {
          try {
            const isValid = await panaccessService.validateSession();
            if (isValid) {
              setIsAuthenticated(true);
              setTimeout(() => navigate(getInitialRoute(currentBrand)), splashDuration);
              return;
            }
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[Splash] Sesión inválida:', err.message);
          }
        }

        const credentials = userSession.getCredentials() ?? userSession.getCredentialsWithFallback(currentBrand?.token);
        if (!credentials) {
          setTimeout(() => navigate('/login'), splashDuration);
          return;
        }

        await loginAndActivateLicense(currentBrand, credentials, {
          autoActivateLicense: true,
          storeClientConfig: true,
          storeLicenses: true,
        });
        setIsAuthenticated(true);
        setTimeout(() => navigate(getInitialRoute(currentBrand)), splashDuration);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[Splash] Auto-login falló:', err);
        userSession.setLoggedOut();
        setTimeout(() => navigate('/login'), splashDuration);
      }
    };

    run();
  }, [navigate, currentBrand, isLoading, splashDuration]);

  // Mostrar loading mientras carga el brand
  if (isLoading || !currentBrand) {
    return (
      <div className="splash-page">
        <div className="splash-content">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  // Obtener imagen de splash (puede ser .png, .gif, .webp, .jpg según configuración)
  const splashImage = currentBrand.assets?.splash || getImage('splash.png') || getImage('splash.gif');

  return (
    <div className="splash-page">
      <div className="splash-content">
        {splashImage && (
          <img 
            src={splashImage} 
            alt={t('splash.alt', { appName })}
            className="splash-image"
          />
        )}
      </div>
    </div>
  );
}

export default SplashPage;
