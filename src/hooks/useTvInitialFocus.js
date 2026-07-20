import { useEffect } from 'react';
import { useDevice } from '../contexts/DeviceContext';
import { focusFirstIn } from '../navigation/spatialNavigation';

/**
 * Coloca el foco en el primer elemento enfocable dentro de `selector` cuando
 * la pantalla se activa (montaje, cambio de ruta, o cualquier dependencia
 * adicional que se le pase — típicamente "los datos ya están listos").
 *
 * Reemplaza los ~8 hooks de polling por `requestAnimationFrame` que existían
 * antes (uno por pantalla: muro de Inicio, VOD, EPG, OSMS, Search, Login,
 * SmartCard...). El motor de navegación espacial no necesita un modelo lógico
 * de la pantalla para saber por dónde navegar (eso ya lo resuelve por
 * geometría en cada tecla) — solo necesita un punto de partida inicial.
 *
 * @param {string} selector Selector CSS del contenedor cuyo primer foco enfocable se busca
 * @param {any[]} [deps] Dependencias adicionales para re-disparar (ej. `[dataStatus]`)
 */
export function useTvInitialFocus(selector, deps = []) {
  const { isTV } = useDevice();

  useEffect(() => {
    if (!isTV) return undefined;
    const cancel = focusFirstIn(selector);
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTV, selector, ...deps]);
}

export default useTvInitialFocus;
