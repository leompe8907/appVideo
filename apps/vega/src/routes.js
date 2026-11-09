import {devLog} from './devLog';

/**
 * Traduce las rutas que devuelven los flujos del núcleo (`resolveSplashDestination`,
 * `resolvePostLoginRoute`: '/login', '/smartcard', '/profile', '/home/...') a
 * pantallas de la app Vega.
 */
export function screenForWebRoute(route, {hasActiveLicense = false, externalProfiles = false} = {}) {
  const path = String(route || '');
  if (path.startsWith('/home')) return 'home';
  if (path.startsWith('/smartcard')) return 'smartcard';
  if (path.startsWith('/profile')) {
    // Perfiles externos (wind): "¿Quién está viendo?", la licencia la elige el perfil.
    if (externalProfiles) return 'profile';
    // Perfiles de PanAccess (ninguna marca los usa): sin pantalla en Vega. Sin
    // licencia activa, ir al home dejaría la app sin poder reproducir.
    if (hasActiveLicense) return 'home';
    devLog('ruta /profile sin pantalla en Vega ni licencia activa: aviso de perfiles');
    return 'profiles';
  }
  return 'login';
}
