import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regresión: el validador periódico de sesión (`sessionValidator.js`, corre
 * cada 5 min) desloguea POR COMPLETO (borra sessionId + credenciales) a un
 * dispositivo que sigue perfectamente logueado, solo porque otro dispositivo
 * activó la misma licencia compartida mientras este estaba inactivo. Causa:
 * `checkSessionAndReactivateIfNeeded` propagaba el resultado de reactivar la
 * LICENCIA como si fuera el resultado de validar la SESIÓN — dos cosas
 * independientes. Comparado contra el proyecto de referencia (10foot,
 * `LoginHelper`/`home.js`), que ante este mismo conflicto nunca desloguea:
 * solo pausa y pregunta (`licenseEnded`), y al iniciar sesión FRESCA prueba
 * automáticamente otra licencia libre en vez de pelear por la ocupada.
 */

vi.mock('../panaccessService', () => ({
  default: {
    client: {},
    initialize: vi.fn(async () => {}),
    loggedIn: vi.fn(async () => true),
    getStreamingLicenses: vi.fn(async () => []),
    setStreamingLicense: vi.fn(async () => {}),
    getAvailableStreams: vi.fn(async () => ({ answer: [{ id: 1 }] })),
    callLoginApi: vi.fn(async () => 'session-xyz'),
    getClientConfig: vi.fn(async () => ({})),
  },
}));

vi.mock('../../utils/userSession', () => ({
  getActiveLicense: vi.fn(),
  setActiveLicense: vi.fn(),
  getSessionId: vi.fn(() => 'session-abc'),
  isAuthenticated: vi.fn(() => true),
  getCredentials: vi.fn(() => null),
  getCredentialsWithFallback: vi.fn(() => null),
  getUdidOrCreate: vi.fn(() => 'udid-123'),
  setLoggedIn: vi.fn(),
  setLoggedOut: vi.fn(),
}));

vi.mock('../deviceAuthService', () => ({ clearDeviceSessionAuth: vi.fn() }));
vi.mock('../deviceSessionService', () => ({
  closeActiveDeviceSession: vi.fn(),
  registerDeviceSession: vi.fn(async () => ({})),
  getStoredDeviceToken: vi.fn(() => ''),
  getStoredDeviceId: vi.fn(() => ''),
  restoreStoredDeviceSession: vi.fn(),
}));

import panaccessService from '../panaccessService';
import * as userSession from '../../utils/userSession';
import {
  reactivateLicense,
  checkSessionAndReactivateIfNeeded,
} from '../loginFlow';

const BRAND = { token: 'brand-token' };

function license(key, extra = {}) {
  return { key, pin: '', products: 'basic', ...extra };
}

describe('loginFlow — reactivateLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    panaccessService.client = {};
    panaccessService.loggedIn.mockResolvedValue(true);
    panaccessService.getAvailableStreams.mockResolvedValue({ answer: [{ id: 1 }] });
  });

  it('sin licencia activa guardada, no llama a la API y devuelve true', async () => {
    userSession.getActiveLicense.mockReturnValue(null);

    const ok = await reactivateLicense(BRAND, true);

    expect(ok).toBe(true);
    expect(panaccessService.setStreamingLicense).not.toHaveBeenCalled();
  });

  it('reactiva la licencia guardada sin problemas cuando nadie más la tomó', async () => {
    userSession.getActiveLicense.mockReturnValue({ licenseKey: 'AAA', pin: '1234' });
    panaccessService.setStreamingLicense.mockResolvedValue({});

    const ok = await reactivateLicense(BRAND, true);

    expect(ok).toBe(true);
    expect(panaccessService.setStreamingLicense).toHaveBeenCalledTimes(1);
    expect(panaccessService.setStreamingLicense).toHaveBeenCalledWith(
      expect.objectContaining({ licenseKey: 'AAA', failIfInUse: true }),
    );
  });

  it('con failIfInUse=false (reactivación tras background), si la licencia falla NO prueba otras', async () => {
    userSession.getActiveLicense.mockReturnValue({ licenseKey: 'AAA', pin: '1234' });
    panaccessService.setStreamingLicense.mockRejectedValue(new Error('license_already_in_use'));

    const ok = await reactivateLicense(BRAND, false);

    expect(ok).toBe(false);
    expect(panaccessService.getStreamingLicenses).not.toHaveBeenCalled();
  });

  it('con failIfInUse=true, si la licencia guardada está en uso, prueba otra licencia libre de la cuenta', async () => {
    userSession.getActiveLicense.mockReturnValue({ licenseKey: 'AAA', pin: '' });
    panaccessService.getStreamingLicenses.mockResolvedValue([license('AAA'), license('BBB')]);
    panaccessService.setStreamingLicense.mockImplementation(async ({ licenseKey }) => {
      if (licenseKey === 'AAA') throw new Error('license_already_in_use');
      return {};
    });

    const ok = await reactivateLicense(BRAND, true);

    expect(ok).toBe(true);
    expect(panaccessService.setStreamingLicense).toHaveBeenCalledWith(
      expect.objectContaining({ licenseKey: 'BBB' }),
    );
    expect(userSession.setActiveLicense).toHaveBeenCalledWith({ licenseKey: 'BBB', pin: '' });
  });

  it('si TODAS las licencias de la cuenta están en uso, devuelve false sin lanzar', async () => {
    userSession.getActiveLicense.mockReturnValue({ licenseKey: 'AAA', pin: '' });
    panaccessService.getStreamingLicenses.mockResolvedValue([license('AAA'), license('BBB')]);
    panaccessService.setStreamingLicense.mockRejectedValue(new Error('license_already_in_use'));

    const ok = await reactivateLicense(BRAND, true);

    expect(ok).toBe(false);
    expect(userSession.setActiveLicense).not.toHaveBeenCalled();
  });
});

describe('loginFlow — checkSessionAndReactivateIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    panaccessService.client = {};
    panaccessService.loggedIn.mockResolvedValue(true);
    panaccessService.getAvailableStreams.mockResolvedValue({ answer: [{ id: 1 }] });
    userSession.getSessionId.mockReturnValue('session-abc');
  });

  it('sesión válida + licencia reactivada sin problema -> {ok:true}', async () => {
    userSession.getActiveLicense.mockReturnValue({ licenseKey: 'AAA', pin: '' });
    panaccessService.setStreamingLicense.mockResolvedValue({});

    const result = await checkSessionAndReactivateIfNeeded(BRAND, { failIfInUse: true });

    expect(result).toEqual({ ok: true, reason: 'ok' });
  });

  it('REGRESIÓN: sesión válida pero la licencia la tomó otro dispositivo y no hay otra libre -> sigue ok:true (no desloguea)', async () => {
    userSession.getActiveLicense.mockReturnValue({ licenseKey: 'AAA', pin: '' });
    panaccessService.getStreamingLicenses.mockResolvedValue([license('AAA')]);
    panaccessService.setStreamingLicense.mockRejectedValue(new Error('license_already_in_use'));

    const result = await checkSessionAndReactivateIfNeeded(BRAND, { failIfInUse: true });

    // La sesión (login) sigue siendo válida -- perder la licencia compartida
    // no es motivo para desloguear. El usuario se queda sin licencia activa
    // hasta que la reclame (SmartCardPage) o reproduzca algo (PlayerContext).
    expect(result.ok).toBe(true);
    expect(userSession.setLoggedOut).not.toHaveBeenCalled();
  });

  it('sesión válida, licencia en uso, pero hay otra libre -> la toma y sigue ok:true', async () => {
    userSession.getActiveLicense.mockReturnValue({ licenseKey: 'AAA', pin: '' });
    panaccessService.getStreamingLicenses.mockResolvedValue([license('AAA'), license('BBB')]);
    panaccessService.setStreamingLicense.mockImplementation(async ({ licenseKey }) => {
      if (licenseKey === 'AAA') throw new Error('license_already_in_use');
      return {};
    });

    const result = await checkSessionAndReactivateIfNeeded(BRAND, { failIfInUse: true });

    expect(result.ok).toBe(true);
    expect(userSession.setActiveLicense).toHaveBeenCalledWith({ licenseKey: 'BBB', pin: '' });
  });

  it('sesión realmente inválida (loggedIn false) y sin credenciales guardadas -> {ok:false, reason:"invalid"}', async () => {
    panaccessService.loggedIn.mockResolvedValue(false);
    userSession.getCredentials.mockReturnValue(null);
    userSession.getCredentialsWithFallback.mockReturnValue(null);

    const result = await checkSessionAndReactivateIfNeeded(BRAND, { failIfInUse: true });

    // Sin credenciales guardadas, reactivateSessionOrThrow no puede
    // continuar -- lo clasifica como AUTH_ERROR (canRetry:false) -> 'invalid'.
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('sin sessionId, devuelve {ok:false, reason:"invalid"} de inmediato', async () => {
    userSession.getSessionId.mockReturnValue('');

    const result = await checkSessionAndReactivateIfNeeded(BRAND, { failIfInUse: true });

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('REGRESIÓN (sessionValidator): un fallo de red/timeout durante el re-login no se trata como sesión inválida', async () => {
    // Sesión no válida (ej. tras un tiempo largo en background) + hay
    // credenciales guardadas -> intenta reactivateSessionOrThrow, que
    // termina llamando a clientLogin. Si ESE request específico falla por
    // timeout (típico justo al volver de background, la peor conectividad
    // posible), `reason` debe ser 'network', no 'invalid' -- así
    // `sessionValidator.js` sabe que no debe desloguear ni disparar
    // `clearSessionBeforeNewLogin()` por un problema transitorio.
    panaccessService.loggedIn.mockResolvedValue(false);
    userSession.getCredentials.mockReturnValue({ username: 'user', password: 'pass' });
    const timeoutError = new Error('Request timeout after 8000ms');
    timeoutError.isTimeout = true;
    panaccessService.callLoginApi.mockRejectedValue(timeoutError);

    vi.useFakeTimers();
    const promise = checkSessionAndReactivateIfNeeded(BRAND, { failIfInUse: true });
    // retryOperation: maxRetries=2, baseDelay=800 -> reintentos a 800ms y 1600ms.
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(1600);
    const result = await promise;
    vi.useRealTimers();

    expect(result).toEqual({ ok: false, reason: 'network' });
    expect(panaccessService.callLoginApi).toHaveBeenCalledTimes(3);
    expect(userSession.setLoggedOut).not.toHaveBeenCalled();
  });
});
