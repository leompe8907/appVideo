import {devLog} from './devLog';

/**
 * Traduce las rutas que devuelven los flujos del núcleo (`resolveSplashDestination`,
 * `resolvePostLoginRoute`: '/login', '/smartcard', '/profile', '/home/...') a
 * pantallas de la app Vega.
 */
export function screenForWebRoute(route, {hasActiveLicense = false} = {}) {
  const path = String(route || '');
  if (path.startsWith('/home')) return 'home';
  if (path.startsWith('/smartcard')) return 'smartcard';
  if (path.startsWith('/profile')) {
    // Sin pantalla de perfiles todavía (tarea 34). Con perfiles externos (wind)
    // la licencia la elige el perfil: sin licencia activa, ir al home dejaría la
    // app sin poder reproducir. Con una licencia activa se sigue como antes.
    if (hasActiveLicense) return 'home';
    devLog('ruta /profile sin pantalla en Vega ni licencia activa: aviso de perfiles');
    return 'profiles';
  }
  return 'login';
}
