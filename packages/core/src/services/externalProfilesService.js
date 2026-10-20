/**
 * Perfiles del backend externo de la marca (`/api/v1/profiles/`, hoy Wind), con el mismo JWT de
 * "dispositivos vinculados" (`deviceAuthService.js`). Contrato en el repo de
 * Back-Wind-V2: docs/IMPLEMENTACION_PERFILES_WIND_2026-10-15.md.
 *
 * Un perfil externo lleva una licencia de streaming de la cuenta. Para
 * reproducir, la app sigue activando la licencia con `setStreamingLicense`
 * como siempre; el backend solo dice cuál (`selectProfile` devuelve las candidatas
 * en orden) y registra cuál se consiguió (`confirmProfileLicense`). Las
 * funciones de perfiles de PanAccess no se usan.
 *
 * Los errores se lanzan con `status` y `code` (el `code` estable del backend:
 * `pin_incorrect`, `pin_locked`, `no_free_license`, `name_taken`,
 * `profiles_disabled`...), para que la UI decida qué mostrar.
 */
import { authorizedDeviceRequest } from './deviceAuthService';
import { getActiveBrandConfig } from '../config/brandConfig';
import { resolveBrandId } from '../utils/brandStorage';
import { getStoredDeviceToken } from './deviceSessionService';

const BASE = '/api/v1/profiles/';

async function request(path, init) {
  try {
    return await authorizedDeviceRequest(getActiveBrandConfig(), resolveBrandId(), path, init);
  } catch (e) {
    if (e && e.data && typeof e.data.code === 'string') e.code = e.data.code;
    throw e;
  }
}

function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body || {}) });
}

/** La cuenta no tiene perfiles encendidos en el backend (ni global ni piloto). */
export function isProfilesDisabledError(error) {
  return error?.status === 404 && error?.code === 'profiles_disabled';
}

/** @returns {Promise<{profiles: Array, slots: {total: number, used: number, free: number}}>} */
export async function listProfiles() {
  const data = await request(BASE, { method: 'GET' });
  return {
    profiles: Array.isArray(data?.profiles) ? data.profiles : [],
    slots: data?.slots || { total: 0, used: 0, free: 0 },
  };
}

export function createProfile({ name, avatarId, isKids, maxAge, pin } = {}) {
  const body = { name, isKids: !!isKids, maxAge: maxAge ?? null };
  if (avatarId != null) body.avatarId = avatarId;
  if (pin) body.pin = pin;
  return post(BASE, body);
}

/**
 * @param {number} id
 * @param {Object} changes - `name`, `avatarId`, `isKids`, `maxAge`, `newPin` (`null` quita el PIN).
 * @param {string} [pin] - PIN actual, si el perfil tiene.
 */
export function updateProfile(id, changes, pin) {
  return request(`${BASE}${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ ...changes, ...(pin ? { pin } : {}) }),
  });
}

export function deleteProfile(id, pin) {
  return request(`${BASE}${id}/`, { method: 'DELETE', body: JSON.stringify(pin ? { pin } : {}) });
}

export function verifyProfilePin(id, pin) {
  return post(`${BASE}${id}/verify-pin/`, { pin });
}

/** "Olvidé el PIN": la contraseña de la cuenta lo quita (o fija `newPin`). */
export function resetProfilePin(id, currentPassword, newPin) {
  return post(`${BASE}${id}/reset-pin/`, { currentPassword, ...(newPin ? { newPin } : {}) });
}

/**
 * El dispositivo entra al perfil.
 * @returns {Promise<{profile: Object, licenseSn: string|null, licenses: Array<{sn: string, loan: boolean}>,
 *   activeElsewhere: Array<{id: number, deviceType: string, deviceModel: string}>, confirmToken: string}>}
 */
export function selectProfile(id, { pin } = {}) {
  const deviceToken = getStoredDeviceToken();
  return post(`${BASE}${id}/select/`, {
    ...(pin ? { pin } : {}),
    ...(deviceToken ? { deviceToken } : {}),
  });
}

/** Avisa qué licencia se consiguió activar; si no es la del perfil, queda como préstamo. */
export function confirmProfileLicense(id, { licenseSn, confirmToken }) {
  const deviceToken = getStoredDeviceToken();
  return post(`${BASE}${id}/select/confirm/`, {
    licenseSn,
    confirmToken,
    ...(deviceToken ? { deviceToken } : {}),
  });
}
