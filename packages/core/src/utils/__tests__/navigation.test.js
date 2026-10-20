import { describe, it, expect, vi, beforeEach } from 'vitest';

let activeLicense = null;
vi.mock('../userSession', () => ({ getActiveLicense: () => activeLicense }));
vi.mock('../../platform/storage', () => ({ storageGet: () => null }));

import { resolvePostLoginRoute, usesWindProfiles } from '../navigation';

const windProfiles = { features: { profiles: true, profilesSource: 'wind' } };

describe('resolvePostLoginRoute', () => {
  beforeEach(() => {
    activeLicense = null;
  });

  it('con perfiles de Wind va a /profile aunque no haya licencia: la elige el perfil', () => {
    expect(usesWindProfiles(windProfiles)).toBe(true);
    expect(resolvePostLoginRoute(windProfiles)).toBe('/profile');
  });

  it('sin perfiles de Wind sigue igual: sin licencia, a elegir tarjeta', () => {
    expect(usesWindProfiles({ features: { profiles: true } })).toBe(false);
    expect(resolvePostLoginRoute({ features: { profiles: true } })).toBe('/smartcard');
    activeLicense = { licenseKey: 'SN1' };
    expect(resolvePostLoginRoute({ features: {} })).toBe('/home/inicio');
  });
});
