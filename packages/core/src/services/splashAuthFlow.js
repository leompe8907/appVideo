/**
 * Resuelve la ruta destino tras validar sesión / UDID / autologin en el splash.
 * No navega; solo devuelve el path para que SplashPage controle las fases visuales.
 */

import panaccessService from './panaccessService';
import { reactivateLicense, reactivateSession } from './loginFlow';
import * as userSession from '../utils/userSession';
import { resolvePostLoginRoute } from '../utils/navigation';

/**
 * @param {Object} brandConfig - currentBrand enriquecido
 * @returns {Promise<string>} Ruta React Router ('/login', '/home/inicio', etc.)
 */
export async function resolveSplashDestination(brandConfig) {
  if (!brandConfig) return '/login';

  try {
    if (!panaccessService.client) {
      await panaccessService.initialize(brandConfig);
    }

    if (userSession.getSessionId()) {
      try {
        const isValid = await panaccessService.validateSession();
        if (isValid) {
          const active = userSession.getActiveLicense?.();
          const hasActiveLicense = !!active?.licenseKey;
          let reactivatedOk = false;

          if (hasActiveLicense) {
            try {
              reactivatedOk = await reactivateLicense(brandConfig, true);
            } catch {
              reactivatedOk = false;
            }
          }

          if (hasActiveLicense && reactivatedOk) {
            return resolvePostLoginRoute(brandConfig);
          }

          const credentials =
            userSession.getCredentials() ??
            userSession.getCredentialsWithFallback(brandConfig?.token);

          if (!credentials) return '/login';

          await reactivateSession(brandConfig, {
            failIfInUse: true,
            storeClientConfig: true,
            storeLicenses: true,
          });

          return resolvePostLoginRoute(brandConfig);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[Splash] Sesión inválida:', err.message);
      }
    }

    return runGoToLoginOrHome(brandConfig);
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Splash] Auto-login falló:', err);
    userSession.setLoggedOut();
    return '/login';
  }
}

async function runGoToLoginOrHome(brandConfig) {
  const goToLoginOrHome = async () => {
    const credentials =
      userSession.getCredentials() ??
      userSession.getCredentialsWithFallback(brandConfig?.token);

    if (!credentials) return '/login';

    await reactivateSession(brandConfig, {
      failIfInUse: true,
      storeClientConfig: true,
      storeLicenses: true,
    });

    return resolvePostLoginRoute(brandConfig);
  };

  const apiBaseUrl = brandConfig?.api?.baseUrl;
  const hasApiBase = typeof apiBaseUrl === 'string' && apiBaseUrl.trim() !== '';

  if (!hasApiBase) {
    return goToLoginOrHome();
  }

  const udid = userSession.getUdidOrCreate();
  if (!udid) {
    return goToLoginOrHome();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const base = apiBaseUrl.replace(/\/$/, '');
    const url = `${base}/udid/validate/?udid=${encodeURIComponent(udid)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const serverUnavailable = response.status >= 500;
      if (!serverUnavailable) {
        userSession.setLoggedOut();
      }
      return goToLoginOrHome();
    }

    const data = await response.json().catch(() => ({}));
    const status = data?.status;
    const validatedUdid = data?.udid;

    if (import.meta.env.DEV) {
      console.log('[Splash] UDID validado', { status, validatedUdid });
    }

    if (status === 'used' && validatedUdid && validatedUdid === udid) {
      return goToLoginOrHome();
    }
    if (status === 'revoked') {
      userSession.setLoggedOut();
      return goToLoginOrHome();
    }
    if (status === 'pending') {
      return '/login';
    }

    userSession.setLoggedOut();
    return goToLoginOrHome();
  } catch (err) {
    clearTimeout(timeoutId);
    if (import.meta.env.DEV) {
      console.error('[Splash] Error validando UDID:', err);
    }
    return goToLoginOrHome();
  }
}
