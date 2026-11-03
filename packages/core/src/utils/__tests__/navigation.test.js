import { describe, it, expect, vi, beforeEach } from 'vitest';

let activeLicense = null;
vi.mock('../userSession', () => ({ getActiveLicense: () => activeLicense }));
vi.mock('../../platform/storage', () => ({ storageGet: () => null }));

import { resolvePostLoginRoute, usesExternalProfiles } from '../navigation';

const externalProfiles = { features: { profiles: true, profilesSource: 'externo' } };

describe('resolvePostLoginRoute', () => {
  beforeEach(() => {
    activeLicense = null;
  });

  it('con perfiles externos va a /profile aunque no haya licencia: la elige el perfil', () => {
    expect(usesExternalProfiles(externalProfiles)).toBe(true);
    expect(resolvePostLoginRoute(externalProfiles)).toBe('/profile');
  });

  it('con perfiles de PanAccess (o sin indicar) sigue igual: sin licencia, a elegir tarjeta', () => {
    expect(usesExternalProfiles({ features: { profiles: true } })).toBe(false);
    expect(usesExternalProfiles({ features: { profiles: true, profilesSource: 'panaccess' } })).toBe(false);
    expect(usesExternalProfiles({ features: { profiles: false, profilesSource: 'externo' } })).toBe(false);
    expect(resolvePostLoginRoute({ features: { profiles: true } })).toBe('/smartcard');
    activeLicense = { licenseKey: 'SN1' };
    expect(resolvePostLoginRoute({ features: {} })).toBe('/home/inicio');
  });
});
