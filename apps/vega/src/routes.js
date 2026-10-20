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
    // Sin pantalla de perfiles todavía (tarea 34). Con perfiles externos (wind)
    // la licencia la elige el perfil: ir al home dejaría la app sin licencia.
    devLog('ruta /profile sin pantalla en Vega: aviso de perfiles');
    return 'profiles';
  }
  return 'login';
}
