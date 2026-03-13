/**
 * Puerta de precarga: muestra PreloadScreen hasta que los datos requeridos (p. ej. EPG) estén listos.
 * Cuando required incluye "epg", muestra la pantalla de carga hasta epg.status === 'ready' (o error/timeout).
 */

import { usePreload } from '../../contexts/PreloadContext';
import { PreloadScreen } from './PreloadScreen';

export function PreloadGate({ required = 'epg', children }) {
  const { epg } = usePreload();

  const needsEpg = required === 'epg' || (Array.isArray(required) && required.includes('epg'));
  const epgReady = epg.status === 'ready' || epg.status === 'error';

  if (needsEpg && !epgReady) {
    return <PreloadScreen />;
  }

  return children;
}

export default PreloadGate;
