import {useEffect} from 'react';
import {AppState} from 'react-native';
import {useOsmsStore} from '@appvideo/core/store/osmsStore';
import {isAuthenticated} from '@appvideo/core/utils/userSession';

const POLL_MS = 2 * 60 * 1000;
const DAYS = 30;

/**
 * Sondeo de mensajes OSMS mientras el home está montado (useOsmsPolling de la
 * web): carga al entrar, incremental cada 2 min y al volver a primer plano.
 */
export function useOsmsPolling(enabled) {
  const pollOsms = useOsmsStore((s) => s.pollOsms);

  useEffect(() => {
    if (!enabled || !isAuthenticated()) return undefined;
    pollOsms({days: DAYS, mode: 'auto'});
    const id = setInterval(() => pollOsms({days: DAYS, mode: 'incremental'}), POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pollOsms({days: DAYS, mode: 'incremental'});
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [enabled, pollOsms]);
}
