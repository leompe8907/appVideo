import { useEffect, useState } from 'react';
import { createUdidLoginFlow, UDID_ACTIVE_STATUSES } from '@appvideo/core/services/udidLoginFlow';

// Logs del pareo: en desarrollo, o en un TV con localStorage.udid_debug = '1'.
const UDID_DEBUG =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('udid_debug') === '1');

const udidLogger = UDID_DEBUG
  ? {
      log: (...args) => console.log('[UDID]', ...args),
      warn: (...args) => console.warn('[UDID]', ...args),
    }
  : undefined;

/**
 * Login con código (UDID). La lógica vive en `@appvideo/core/services/udidLoginFlow`
 * (compartida con Vega); este hook sólo la conecta a React.
 */
export function useUdidLoginFlow({ config, appName, onCredentials, t }) {
  const [flow] = useState(() => createUdidLoginFlow({ config, onCredentials, t, logger: udidLogger }));
  const [state, setState] = useState(() => flow.getState());

  // config/onCredentials/t pueden cambiar entre renders: el pareo en curso usa los últimos.
  useEffect(() => {
    flow.setOptions({ config, onCredentials, t });
  });

  useEffect(() => {
    setState(flow.getState());
    const unsubscribe = flow.subscribe(setState);
    return () => {
      unsubscribe();
      flow.destroy();
    };
  }, [flow]);

  return {
    status: state.status,
    error: state.error,
    code: state.code,
    tempToken: state.tempToken,
    remainingSeconds: state.remainingSeconds,
    appName: appName || 'App',
    isActive: UDID_ACTIVE_STATUSES.includes(state.status),
    start: flow.start,
    retry: flow.retry,
    cancel: flow.cancel,
  };
}

export default useUdidLoginFlow;
