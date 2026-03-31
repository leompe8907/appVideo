import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import * as userSession from '../utils/userSession';
import { checkSessionAndReactivateIfNeeded } from '../services/loginFlow';

/**
 * Valida la sesión en rutas protegidas. Si no hay sesión o es inválida,
 * intenta reactivar (re-login + licencia). Si falla, redirige a splash/login.
 */
export function useAuthValidator() {
  const navigate = useNavigate();
  const { currentBrand } = useBrand();

  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      if (cancelled) return;

      if (!userSession.isAuthenticated()) {
        if (import.meta.env.DEV) console.log('[AuthValidator] No hay sessionId. Redirigiendo...');
        navigate('/', { replace: true });
        return;
      }

      if (!currentBrand?.token) {
        if (import.meta.env.DEV) console.warn('[AuthValidator] Sin brand config, esperando...');
        return;
      }

      const ok = await checkSessionAndReactivateIfNeeded(currentBrand, {
        reactivateLicenseIfValid: false,
      });

      if (!ok) {
        if (import.meta.env.DEV) console.warn('[AuthValidator] Sesión inválida o reactivación fallida.');
        userSession.setLoggedOut();
        navigate('/', { replace: true });
      }
    };

    // Validar inmediatamente al entrar en la ruta
    validate();

    // Validar periódicamente mientras la ruta esté activa (cada 5 minutos)
    const intervalId = window.setInterval(() => {
      validate();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [navigate, currentBrand]);

  return null;
}

export default useAuthValidator;
