import { describe, it, expect } from 'vitest';
import {
  PROFILE_AVATAR_FILES,
  maxAgeLabel,
  nextStepAfterEnter,
  pickAutoEnterProfile,
  profileErrorMessageKey,
  routeWithoutProfiles,
} from '../externalProfiles';

const t = (key) => key;

describe('pickAutoEnterProfile', () => {
  const a = { id: 1, hasPin: false };
  const b = { id: 2, hasPin: true };

  it('entra solo al último perfil usado si no tiene PIN', () => {
    expect(pickAutoEnterProfile([a, b], 1)).toBe(a);
    expect(pickAutoEnterProfile([a, b], 2)).toBeNull();
  });

  it('si hay un único perfil sin PIN, entra a ese', () => {
    expect(pickAutoEnterProfile([a], null)).toBe(a);
    expect(pickAutoEnterProfile([b], null)).toBeNull();
  });

  it('con varios perfiles y ninguno recordado, muestra la lista', () => {
    expect(pickAutoEnterProfile([a, b], null)).toBeNull();
    expect(pickAutoEnterProfile([], 1)).toBeNull();
  });
});

describe('routeWithoutProfiles', () => {
  it('con licencia activa va al home; si no, a elegir tarjeta', () => {
    expect(routeWithoutProfiles(true)).toBe('/home/inicio');
    expect(routeWithoutProfiles(false)).toBe('/smartcard');
  });
});

describe('nextStepAfterEnter', () => {
  it('ok → home; in_use → preguntar "continuar aquí"; sin licencias → smartcard', () => {
    expect(nextStepAfterEnter({ status: 'ok' })).toEqual({ route: '/home/inicio' });
    const selection = { licenseSn: 'X' };
    expect(nextStepAfterEnter({ status: 'in_use', selection })).toEqual({ inUse: selection });
    expect(nextStepAfterEnter({ status: 'no_licenses' })).toEqual({ route: '/smartcard', keepProfileWithoutLicense: true });
  });
});

describe('profileErrorMessageKey', () => {
  it('pin_locked tiene su mensaje; el resto usa el genérico', () => {
    expect(profileErrorMessageKey({ code: 'pin_locked' })).toBe('profile.pinLocked');
    expect(profileErrorMessageKey({ code: 'otro' })).toBe('profile.errorActivate');
  });
});

describe('avatares y edad', () => {
  it('los ids 87-95 apuntan a avatars/1..9.png', () => {
    expect(PROFILE_AVATAR_FILES[87]).toBe('avatars/1.png');
    expect(PROFILE_AVATAR_FILES[95]).toBe('avatars/9.png');
  });

  it('edad máxima: sin límite, L o el número', () => {
    expect(maxAgeLabel(t, null)).toBe('profile.maxAgeNone');
    expect(maxAgeLabel(t, 0)).toBe('L');
    expect(maxAgeLabel(t, 14)).toBe('14');
  });
});
