import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regresión: `refreshDeviceSessionAccessToken` borraba los JWT del backend ante
 * CUALQUIER fallo. Con la base del backend saturada (HTTP 503) o sin red, cada
 * dispositivo perdía su sesión y la siguiente reconexión de `/ws/device/`
 * repetía el login completo con contraseña, saturándolo más. Ahora sólo un
 * 400/401 (refresh vencido o anulado) cierra esa sesión.
 */

vi.mock('../recaptchaService', () => ({ getRecaptchaToken: vi.fn(async () => '') }));

import {
  authorizedDeviceRequest,
  getDeviceSessionAccessToken,
  getDeviceSessionRefreshToken,
  persistDeviceSessionAuth,
  refreshDeviceSessionAccessToken,
} from '../deviceAuthService';

const BRAND = 'wind';
const BRAND_CONFIG = {
  brand: BRAND,
  login: { deviceSession: { enabled: true, baseUrl: 'https://backend.example' } },
};

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('deviceAuthService', () => {
  beforeEach(() => {
    persistDeviceSessionAuth({ access: 'access-old', refresh: 'refresh-old' }, BRAND);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('un 503 al refrescar no borra la sesión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(503, { detail: 'Servicio no disponible' })));

    expect(await refreshDeviceSessionAccessToken(BRAND_CONFIG, BRAND)).toBe('');
    expect(getDeviceSessionAccessToken(BRAND)).toBe('access-old');
    expect(getDeviceSessionRefreshToken(BRAND)).toBe('refresh-old');
  });

  it('un corte de red al refrescar no borra la sesión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    expect(await refreshDeviceSessionAccessToken(BRAND_CONFIG, BRAND)).toBe('');
    expect(getDeviceSessionRefreshToken(BRAND)).toBe('refresh-old');
  });

  it('un refresh rechazado (401) sí borra la sesión', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { detail: 'Token is invalid or expired' })));

    expect(await refreshDeviceSessionAccessToken(BRAND_CONFIG, BRAND)).toBe('');
    expect(getDeviceSessionRefreshToken(BRAND)).toBe('');
  });

  it('un GET con 503 se reintenta una vez tras el Retry-After', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { detail: 'x' }, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(jsonResponse(200, { devices: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authorizedDeviceRequest(BRAND_CONFIG, BRAND, '/wind/devices/')).resolves.toEqual({ devices: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('un POST con 503 no se reintenta y no cierra la sesión', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(503, { detail: 'x' }, { 'Retry-After': '0' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      authorizedDeviceRequest(BRAND_CONFIG, BRAND, '/wind/close-account/', { method: 'POST' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getDeviceSessionAccessToken(BRAND)).toBe('access-old');
  });
});
