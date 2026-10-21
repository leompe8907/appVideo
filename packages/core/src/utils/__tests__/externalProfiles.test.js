import { describe, it, expect } from 'vitest';
import {
  PROFILE_AVATAR_FILES,
  buildProfilePayload,
  canChangeProfile,
  maxAgeAfterKidsToggle,
  profileFormErrorKey,
  validateProfileForm,
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

  it('si hay un único perfil sin PIN, entra a ese', () => {
    expect(pickAutoEnterProfile([a])).toBe(a);
  });

  it('un único perfil con PIN muestra la lista (hay que pedir el PIN)', () => {
    expect(pickAutoEnterProfile([b])).toBeNull();
  });

  it('con varios perfiles muestra siempre la lista, aunque el último usado no tenga PIN', () => {
    const c = { id: 3, hasPin: false };
    expect(pickAutoEnterProfile([a, c])).toBeNull();
    expect(pickAutoEnterProfile([a, b])).toBeNull();
    expect(pickAutoEnterProfile([])).toBeNull();
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

describe('formulario de perfil', () => {
  it('valida nombre obligatorio y PIN de 4 a 6 dígitos (opcional)', () => {
    expect(validateProfileForm({ name: '  ', newPin: '' })).toBe('profile.createNameRequired');
    expect(validateProfileForm({ name: 'Ana', newPin: '12' })).toBe('profile.pinFormatError');
    expect(validateProfileForm({ name: 'Ana', newPin: '1234567' })).toBe('profile.pinFormatError');
    expect(validateProfileForm({ name: 'Ana', newPin: '' })).toBeNull();
    expect(validateProfileForm({ name: 'Ana', newPin: '1234' })).toBeNull();
  });

  it('al marcar infantil sin edad, la edad queda en 10 (como el backend)', () => {
    expect(maxAgeAfterKidsToggle(true, null)).toBe(10);
    expect(maxAgeAfterKidsToggle(true, 14)).toBe(14);
    expect(maxAgeAfterKidsToggle(false, 10)).toBe(10);
  });

  it('crear: manda el PIN sólo si se escribió', () => {
    const base = { mode: 'create', name: ' Ana ', avatarId: 87, isKids: false, maxAge: null };
    expect(buildProfilePayload({ ...base, newPin: '' })).toEqual({ name: 'Ana', avatarId: 87, isKids: false, maxAge: null });
    expect(buildProfilePayload({ ...base, newPin: '1234' }).pin).toBe('1234');
  });

  it('editar: newPin con el PIN nuevo, null para quitarlo, o sin cambio', () => {
    const base = { mode: 'edit', name: 'Ana', avatarId: 88, isKids: true, maxAge: 10 };
    expect(buildProfilePayload({ ...base, newPin: '', removePin: false })).toEqual({ name: 'Ana', avatarId: 88, isKids: true, maxAge: 10 });
    expect(buildProfilePayload({ ...base, newPin: '5678', removePin: false }).newPin).toBe('5678');
    expect(buildProfilePayload({ ...base, newPin: '5678', removePin: true }).newPin).toBeNull();
  });

  it('errores del backend con mensaje propio', () => {
    expect(profileFormErrorKey({ code: 'name_taken' })).toBe('profile.errorNameTaken');
    expect(profileFormErrorKey({ code: 'no_free_license' })).toBe('profile.errorNoFreeLicense');
    expect(profileFormErrorKey({ code: 'invalid_pin_format' })).toBe('profile.pinFormatError');
    expect(profileFormErrorKey({ code: 'owner_profile' })).toBe('profile.errorOwner');
    expect(profileFormErrorKey({ code: 'otro' })).toBeNull();
  });
});

describe('canChangeProfile', () => {
  const external = { features: { profiles: true, profilesSource: 'externo' } };
  it('con perfiles externos, sólo si hay un perfil activo', () => {
    expect(canChangeProfile(external, 5)).toBe(true);
    expect(canChangeProfile(external, null)).toBe(false);
  });
  it('sin perfiles, nunca; con perfiles de PanAccess, siempre', () => {
    expect(canChangeProfile({ features: { profiles: false } }, 5)).toBe(false);
    expect(canChangeProfile({ features: { profiles: true, profilesSource: 'panaccess' } }, null)).toBe(true);
  });
});
