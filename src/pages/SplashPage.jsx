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

        // Helper equivalente a goToLoginOrHome del proyecto 10foot
        const goToLoginOrHome = async () => {
          const credentials =
            userSession.getCredentials() ??
            userSession.getCredentialsWithFallback(currentBrand?.token);

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
        };

        const apiBaseUrl = currentBrand?.api?.baseUrl;
        const hasApiBase = typeof apiBaseUrl === 'string' && apiBaseUrl.trim() !== '';

        // Si no hay backend propio configurado, usar el flujo clásico
        if (!hasApiBase) {
          await goToLoginOrHome();
          return;
        }

        const udid = userSession.getUdidOrCreate();

        // Si no hay UDID almacenado, ir al flujo normal de login/autologin
        if (!udid) {
          await goToLoginOrHome();
          return;
        }

        // Validación de UDID contra backend propio: GET {baseUrl}/udid/validate/?udid=...
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const base = apiBaseUrl.replace(/\/$/, '');
          const url = `${base}/udid/validate/?udid=${encodeURIComponent(udid)}`;

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            // Aproximación a la lógica original: sólo limpiar si no parece error de servidor
            const serverUnavailable = response.status >= 500;
            if (!serverUnavailable) {
              userSession.setLoggedOut();
            }
            await goToLoginOrHome();
            return;
          }

          const data = await response.json().catch(() => ({}));
          const status = data && data.status;
          const validatedUdid = data && data.udid;

          if (import.meta.env.DEV) {
            console.log('[Splash] UDID validado', { status, validatedUdid });
          }

          if (status === 'used' && validatedUdid && validatedUdid === udid) {
            // UDID válido y ya usado → intentar login automático
            await goToLoginOrHome();
          } else if (status === 'revoked') {
            // UDID revocado → limpiar credenciales y seguir flujo normal
            userSession.setLoggedOut();
            await goToLoginOrHome();
          } else if (status === 'pending') {
            // UDID pendiente → ir directo a login
            setTimeout(() => navigate('/login'), splashDuration);
          } else {
            // Cualquier otro caso inesperado → limpiar y flujo normal
            userSession.setLoggedOut();
            await goToLoginOrHome();
          }
        } catch (err) {
          clearTimeout(timeoutId);
          if (import.meta.env.DEV) {
            console.error('[Splash] Error validando UDID:', err);
          }

          // Error de red/timeout: considerar backend caído, no limpiar credenciales
          await goToLoginOrHome();
        }
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
