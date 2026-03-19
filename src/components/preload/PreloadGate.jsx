/**
 * Puerta de precarga: muestra PreloadScreen hasta que los datos requeridos (p. ej. EPG) estén listos.
 * Cuando required incluye "epg", muestra la pantalla de carga hasta epg.status === 'ready' (o error/timeout).
 */

import { Navigate, useLocation } from 'react-router-dom';
import { usePreload } from '../../contexts/PreloadContext';

export function PreloadGate({ required = 'epg', children }) {
  const { epg } = usePreload();
  const location = useLocation();

  const needsEpg = required === 'epg' || (Array.isArray(required) && required.includes('epg'));
  const epgReady = epg.status === 'ready' || epg.status === 'error';

  if (needsEpg && !epgReady) {
    // Redirigir al preload conservando destino para volver al módulo solicitado.
    const redirectTo = `${location.pathname}${location.search || ''}${location.hash || ''}`;
    return <Navigate to={`/preload?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  return children;
}

export default PreloadGate;
