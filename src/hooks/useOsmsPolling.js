import { useEffect } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { useOsmsStore } from '../store/osmsStore';
import { isAuthenticated } from '../utils/userSession';

/**
 * Polling de OSMS mientras estás en /home/*.
 * - Refresh al montar
 * - Refresh al volver a foreground
 * - Intervalo configurable (default 2 min)
 */
export function useOsmsPolling(options = {}) {
  const { currentBrand } = useBrand();
  const enabled = Boolean(currentBrand?.features?.osms);
  const refreshOsms = useOsmsStore((s) => s.refreshOsms);

  useEffect(() => {
    if (!enabled) return;
    if (!isAuthenticated()) return;

    const intervalMs = Number(options.intervalMs ?? 2 * 60 * 1000);
    const days = Number(options.days ?? 30);

    let cancelled = false;
    const refresh = (force) => {
      if (cancelled) return;
      refreshOsms({ force: !!force, days });
    };

    refresh(false);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const id = window.setInterval(() => refresh(false), Number.isFinite(intervalMs) ? intervalMs : 120000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(id);
    };
  }, [enabled, refreshOsms, options.intervalMs, options.days]);
}

export default useOsmsPolling;

