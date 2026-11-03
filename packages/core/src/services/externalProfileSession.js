/**
 * Entrar a un perfil externo: el backend dice qué licencias puede usar el
 * perfil (la suya primero, después las libres para préstamo) y la app las
 * prueba en orden con `setStreamingLicense(..., failIfInUse: true)`, como ya
 * hace al iniciar sesión. PanAccess decide cuál está en uso; el backend solo se
 * entera de cuál se consiguió (`confirmProfileLicense`), para atribuir la
 * telemetría al perfil.
 *
 * Lo que queda guardado en el dispositivo es el perfil JUNTO con su licencia
 * (`activeProfileStore` + `userSession.setActiveLicense`), para que la
 * recuperación del reproductor y el próximo arranque usen la licencia del
 * perfil y no una vieja. Al volver a abrir la app se vuelve a llamar a
 * `enterProfile`: el perfil pudo borrarse o su licencia pasar a otro.
 *
 * Reservas de tarjeta: el backend no ofrece las tarjetas que otro dispositivo
 * está usando (van en `selection.inUse`) y `confirm` devuelve la reserva que
 * `profileLeaseKeeper.js` mantiene viva con latidos hasta salir del perfil.
 */
import * as userSession from '../utils/userSession';
import { getLicenseKey, getLicensePin } from '../utils/licenseProducts';
import { useActiveProfileStore } from '../store/activeProfileStore';
import { activateLicense, getLicensesWithPins } from './loginFlow';
import { confirmProfileLicense, selectProfile } from './externalProfilesService';
import { syncPreferencesFromBackend } from './preferencesSyncService';
import { startProfileLease, stopProfileLease } from './profileLeaseKeeper';

function devWarn(label, error) {
  if (import.meta.env.DEV) {
    console.warn(`[externalProfileSession] ${label}:`, error?.message || error);
  }
}

async function finishEntering(profile, license, loan, selection) {
  let confirmed = null;
  try {
    confirmed = await confirmProfileLicense(profile.id, { licenseSn: license.key, confirmToken: selection.confirmToken });
  } catch (e) {
    // Sin confirmar, el préstamo no queda registrado (la telemetría de esta sesión queda sin
    // perfil), pero la licencia ya está activa: no se le impide ver al usuario.
    devWarn('confirmar la licencia falló', e);
  }
  if (confirmed?.leaseToken) {
    startProfileLease({ token: confirmed.leaseToken, licenseSn: license.key, heartbeatSeconds: confirmed.heartbeatSeconds });
  } else {
    stopProfileLease();
  }
  userSession.setActiveLicense({ licenseKey: license.key, pin: license.pin });
  useActiveProfileStore.getState().setActiveProfile({
    id: profile.id,
    name: profile.name,
    imageId: profile.avatarId,
    source: 'externo',
    maxAge: profile.maxAge,
    isKids: profile.isKids,
    hasPin: profile.hasPin,
    licenseSn: license.key,
    loan,
  });
  // Favoritos y control parental de ESTE perfil (el `profileKey` ya es su id).
  syncPreferencesFromBackend().catch((e) => devWarn('sincronizar preferencias falló', e));
  return { status: 'ok', licenseSn: license.key, loan };
}

/**
 * @param {Object} brandConfig
 * @param {Object} profile - Perfil tal como lo devuelve `listProfiles`.
 * @param {{ pin?: string }} [options] - PIN del perfil si `hasPin` (lo verifica el backend).
 * @returns {Promise<
 *   {status: 'ok', licenseSn: string, loan: boolean}
 *   | {status: 'in_use', selection: Object}
 *   | {status: 'no_licenses'}
 * >}
 *   `in_use`: todas las licencias están en uso; `takeOverProfileLicense(selection)`
 *   ofrece "continuar aquí". `no_licenses`: la cuenta todavía no tiene licencias
 *   sincronizadas, usar la selección de licencia de siempre.
 * @throws error de `selectProfile` (`pin_incorrect`, `pin_locked`, `profile_not_found`...).
 */
export async function enterProfile(brandConfig, profile, { pin } = {}) {
  const selection = await selectProfile(profile.id, { pin });
  const candidates = Array.isArray(selection?.licenses) ? selection.licenses : [];
  const inUse = Array.isArray(selection?.inUse) ? selection.inUse : [];
  // Con reservas, sin libres pero con tarjetas en uso: todas ocupadas, sin probar PanAccess.
  const allTaken = selection?.leases === true && candidates.length === 0 && inUse.length > 0;
  if (candidates.length === 0 && !allTaken) return { status: 'no_licenses' };

  // El PIN de la propia también, para "continuar aquí".
  const sns = [...new Set([...candidates.map((c) => c.sn), ...(selection.licenseSn ? [selection.licenseSn] : [])])];
  const withPins = await getLicensesWithPins(brandConfig, sns);
  const pinBySn = new Map(withPins.map((l) => [getLicenseKey(l), getLicensePin(l)]));

  for (const candidate of candidates) {
    if (!pinBySn.has(candidate.sn)) continue; // PanAccess no la devuelve: no se puede activar
    const activated = await activateLicense(
      brandConfig,
      { key: candidate.sn, pin: pinBySn.get(candidate.sn) },
      { failIfInUse: true },
    );
    if (activated) {
      return finishEntering({ ...profile, ...(selection.profile || {}) }, activated, candidate.loan === true, selection);
    }
  }
  return { status: 'in_use', selection: { ...selection, profile: { ...profile, ...(selection.profile || {}) }, pinBySn } };
}

/**
 * "Continuar aquí": toma la licencia propia del perfil aunque esté en uso
 * (`failIfInUse: false`, PanAccess cierra la otra sesión). Nunca la de otro perfil.
 * @param {Object} brandConfig
 * @param {Object} selection - el de un resultado `in_use` de `enterProfile`.
 * @returns {Promise<{status: 'ok', licenseSn: string, loan: false} | {status: 'failed'}>}
 */
export async function takeOverProfileLicense(brandConfig, selection) {
  const sn = selection?.licenseSn;
  if (!sn || !selection.pinBySn?.has(sn)) return { status: 'failed' };
  const activated = await activateLicense(
    brandConfig,
    { key: sn, pin: selection.pinBySn.get(sn) },
    { failIfInUse: false },
  );
  if (!activated) return { status: 'failed' };
  return finishEntering(selection.profile, activated, false, selection);
}

/**
 * Salir del perfil (cambiar de perfil o cerrar sesión): se olvida el perfil guardado y su
 * tarjeta queda libre para los demás dispositivos.
 */
export function forgetActiveProfile() {
  stopProfileLease({ release: true });
  useActiveProfileStore.getState().clearActiveProfile();
}
