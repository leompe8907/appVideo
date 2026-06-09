import { Outlet } from 'react-router-dom';
import { PreloadGate } from './PreloadGate';

/**
 * Layout de rutas /home/* que requieren EPG precargado.
 * Evita desmontar PreloadGate al cambiar entre inicio, buscador, epg, etc.
 */
export function HomeEpgRoutesLayout() {
  return (
    <PreloadGate required="epg">
      <Outlet />
    </PreloadGate>
  );
}

export default HomeEpgRoutesLayout;
