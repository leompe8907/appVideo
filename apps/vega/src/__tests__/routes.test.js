import { describe, it, expect } from 'vitest';
import { screenForWebRoute } from '../routes';

describe('screenForWebRoute', () => {
  it('traduce las rutas de la web a pantallas de Vega', () => {
    expect(screenForWebRoute('/home/inicio')).toBe('home');
    expect(screenForWebRoute('/smartcard')).toBe('smartcard');
    expect(screenForWebRoute('/login')).toBe('login');
    expect(screenForWebRoute('')).toBe('login');
  });

  it('/profile no entra al home sin licencia: va al aviso de perfiles', () => {
    // Con perfiles externos (wind) la licencia la elige el perfil: ir al home
    // dejaría la app sin licencia activa.
    expect(screenForWebRoute('/profile')).toBe('profiles');
  });
});
