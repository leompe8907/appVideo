import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Entrar a un perfil de Wind: probar las licencias que da el backend en orden,
 * confirmar la que funcionó y guardar el perfil JUNTO con esa licencia (antes,
 * con los perfiles de PanAccess, la licencia guardada no cambiaba al elegir
 * perfil y la recuperación del reproductor volvía a una licencia vieja).
 */

vi.mock('../windProfilesService', () => ({
  selectProfile: vi.fn(),
  confirmProfileLicense: vi.fn(async () => ({ success: true })),
}));
vi.mock('../loginFlow', () => ({
  activateLicense: vi.fn(),
  getLicensesWithPins: vi.fn(),
}));
vi.mock('../preferencesSyncService', () => ({
  syncPreferencesFromBackend: vi.fn(async () => true),
}));
vi.mock('../../utils/userSession', () => ({
  setActiveLicense: vi.fn(),
}));

import { selectProfile, confirmProfileLicense } from '../windProfilesService';
import { activateLicense, getLicensesWithPins } from '../loginFlow';
import { syncPreferencesFromBackend } from '../preferencesSyncService';
import { setActiveLicense } from '../../utils/userSession';
import { useActiveProfileStore } from '../../store/activeProfileStore';
import { enterProfile, takeOverProfileLicense } from '../windProfileSession';

const BRAND = { brand: 'wind' };
const PROFILE = { id: 7, name: 'Peque', avatarId: 88, isKids: true, maxAge: 10, hasPin: false };

function selection(licenses, extra = {}) {
  return {
    profile: PROFILE,
    licenseSn: licenses.find((l) => !l.loan)?.sn ?? null,
    licenses,
    activeElsewhere: [],
    confirmToken: 'tok',
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useActiveProfileStore.getState().clearActiveProfile();
  getLicensesWithPins.mockResolvedValue([
    { key: 'SN1', pin: '1111' },
    { key: 'SN2', pin: '2222' },
    { key: 'SN3', pin: '3333' },
  ]);
});

describe('enterProfile', () => {
  it('activa la licencia propia, la confirma y guarda el perfil con ella', async () => {
    selectProfile.mockResolvedValue(selection([{ sn: 'SN1', loan: false }, { sn: 'SN2', loan: true }]));
    activateLicense.mockImplementation(async (_b, license) => license);

    const result = await enterProfile(BRAND, PROFILE);

    expect(result).toEqual({ status: 'ok', licenseSn: 'SN1', loan: false });
    expect(activateLicense).toHaveBeenCalledTimes(1);
    expect(activateLicense).toHaveBeenCalledWith(BRAND, { key: 'SN1', pin: '1111' }, { failIfInUse: true });
    expect(confirmProfileLicense).toHaveBeenCalledWith(7, { licenseSn: 'SN1', confirmToken: 'tok' });
    expect(setActiveLicense).toHaveBeenCalledWith({ licenseKey: 'SN1', pin: '1111' });
    const stored = useActiveProfileStore.getState();
    expect(stored).toMatchObject({ id: 7, source: 'wind', maxAge: 10, licenseSn: 'SN1', loan: false, imageId: 88 });
    expect(syncPreferencesFromBackend).toHaveBeenCalled();
  });

  it('si la propia está en uso, toma prestada la siguiente', async () => {
    selectProfile.mockResolvedValue(selection([{ sn: 'SN1', loan: false }, { sn: 'SN2', loan: true }]));
    activateLicense.mockImplementation(async (_b, license) => (license.key === 'SN1' ? null : license));

    const result = await enterProfile(BRAND, PROFILE, { pin: '1234' });

    expect(selectProfile).toHaveBeenCalledWith(7, { pin: '1234' });
    expect(result).toEqual({ status: 'ok', licenseSn: 'SN2', loan: true });
    expect(useActiveProfileStore.getState().loan).toBe(true);
  });

  it('salta las candidatas que PanAccess no devuelve', async () => {
    getLicensesWithPins.mockResolvedValue([{ key: 'SN2', pin: '2222' }]);
    selectProfile.mockResolvedValue(selection([{ sn: 'SN9', loan: false }, { sn: 'SN2', loan: true }]));
    activateLicense.mockImplementation(async (_b, license) => license);

    const result = await enterProfile(BRAND, PROFILE);

    expect(activateLicense).toHaveBeenCalledTimes(1);
    expect(result.licenseSn).toBe('SN2');
  });

  it('todas en uso: no guarda nada y devuelve la selección para "continuar aquí"', async () => {
    selectProfile.mockResolvedValue(selection([{ sn: 'SN1', loan: false }, { sn: 'SN2', loan: true }]));
    activateLicense.mockResolvedValue(null);

    const result = await enterProfile(BRAND, PROFILE);

    expect(result.status).toBe('in_use');
    expect(confirmProfileLicense).not.toHaveBeenCalled();
    expect(setActiveLicense).not.toHaveBeenCalled();
    expect(useActiveProfileStore.getState().id).toBeNull();
  });

  it('cuenta sin licencias sincronizadas: no intenta activar nada', async () => {
    selectProfile.mockResolvedValue(selection([]));

    expect(await enterProfile(BRAND, PROFILE)).toEqual({ status: 'no_licenses' });
    expect(activateLicense).not.toHaveBeenCalled();
  });

  it('un error de PIN llega al llamador', async () => {
    const err = Object.assign(new Error('El PIN no es correcto.'), { code: 'pin_incorrect' });
    selectProfile.mockRejectedValue(err);

    await expect(enterProfile(BRAND, PROFILE, { pin: '0000' })).rejects.toMatchObject({ code: 'pin_incorrect' });
  });

  it('si confirmar falla, la licencia igual queda activa', async () => {
    selectProfile.mockResolvedValue(selection([{ sn: 'SN1', loan: false }]));
    activateLicense.mockImplementation(async (_b, license) => license);
    confirmProfileLicense.mockRejectedValueOnce(new Error('sin red'));

    expect((await enterProfile(BRAND, PROFILE)).status).toBe('ok');
    expect(setActiveLicense).toHaveBeenCalled();
  });
});

describe('takeOverProfileLicense', () => {
  it('toma solo la licencia propia, sin failIfInUse', async () => {
    selectProfile.mockResolvedValue(selection([{ sn: 'SN1', loan: false }, { sn: 'SN2', loan: true }]));
    activateLicense.mockResolvedValue(null);
    const { selection: sel } = await enterProfile(BRAND, PROFILE);
    activateLicense.mockReset().mockImplementation(async (_b, license) => license);

    const result = await takeOverProfileLicense(BRAND, sel);

    expect(activateLicense).toHaveBeenCalledWith(BRAND, { key: 'SN1', pin: '1111' }, { failIfInUse: false });
    expect(result).toEqual({ status: 'ok', licenseSn: 'SN1', loan: false });
  });

  it('un perfil sin licencia propia no puede tomar ninguna', async () => {
    expect(await takeOverProfileLicense(BRAND, { licenseSn: null, pinBySn: new Map() })).toEqual({ status: 'failed' });
  });
});
