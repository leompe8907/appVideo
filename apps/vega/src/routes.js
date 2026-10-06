import {devLog} from './devLog';

/**
 * Traduce las rutas que devuelven los flujos del núcleo (`resolveSplashDestination`,
 * `resolvePostLoginRoute`: '/login', '/smartcard', '/profile', '/home/...') a
 * pantallas de la app Vega.
 */
export function screenForWebRoute(route) {
  const path = String(route || '');
  if (path.startsWith('/home')) return 'home';
  if (path.startsWith('/smartcard')) return 'smartcard';
  if (path.startsWith('/profile')) {
    // TODO(Fase 4): pantalla de perfiles. Ninguna marca de prueba la usa todavía.
    devLog('ruta /profile sin pantalla en Vega: se va al home');
    return 'home';
  }
  return 'login';
}
