import { useEffect } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { useOsmsStore } from '../store/osmsStore';
import { isAuthenticated } from '../utils/userSession';

/**
 * Polling de OSMS mientras estás en /home/*.
 * - Carga inicial al montar
 * - Sondeo incremental cada intervalo (default 2 min)
 * - Refresh incremental al volver a foreground
 */
export function useOsmsPolling(options = {}) {
  const { currentBrand } = useBrand();
  const enabled = Boolean(currentBrand?.features?.osms);
  const pollOsms = useOsmsStore((s) => s.pollOsms);

  useEffect(() => {
    if (!enabled) return;
    if (!isAuthenticated()) return;

    const intervalMs = Number(options.intervalMs ?? 2 * 60 * 1000);
    const days = Number(options.days ?? 30);

    let cancelled = false;
    const poll = (mode) => {
      if (cancelled) return;
      pollOsms({ days, mode });
    };

    poll('auto');

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        poll('incremental');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const id = window.setInterval(
      () => poll('incremental'),
      Number.isFinite(intervalMs) ? intervalMs : 120000
    );

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(id);
    };
  }, [enabled, pollOsms, options.intervalMs, options.days]);
}

export default useOsmsPolling;
