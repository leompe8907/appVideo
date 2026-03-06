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
    const validate = async () => {
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

    validate();
  }, [navigate, currentBrand]);

  return null;
}

export default useAuthValidator;
