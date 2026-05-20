import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import * as userSession from '../utils/userSession';
import { validateSessionIfDue } from '../utils/sessionValidator';

/**
 * En rutas protegidas: redirige si no hay sesión y delega la validación API
 * al validador global (throttle 5 min) iniciado en App.jsx.
 */
export function useAuthValidator() {
  const navigate = useNavigate();
  const { currentBrand } = useBrand();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;

      if (!userSession.isAuthenticated()) {
        navigate('/', { replace: true });
        return;
      }

      if (!currentBrand?.token) return;

      const ok = await validateSessionIfDue(currentBrand);
      if (!cancelled && !ok) {
        navigate('/', { replace: true });
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [navigate, currentBrand]);
}

export default useAuthValidator;
