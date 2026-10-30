/**
 * "Dispositivos vinculados" -- listar y revocar desde la propia app.
 *
 * Panel nativo: solo se muestra en PC/web cuando el brand tiene
 * `login.deviceSession.enabled` (ver `LinkedDevicesPanel.jsx` / `MiCuentaPage.jsx`).
 * En TV, o si el brand no tiene este backend activado, se sigue usando el
 * QR existente (`brand.account.links.linkedDevices`) -- sin cambios.
 *
 * Contrato del backend (hoy Wind, ver wind/device_views.py):
 *   GET  {base}/wind/devices/             -> { devices: [{id, device_type,
 *          device_model, first_seen_at, last_seen_at, client_ip}, ...] }
 *   POST {base}/wind/devices/<id>/revoke/ -> { ok: true }
 *          | { ok: false, code: 'not_found'|'already_revoked'|'subscriber_unresolved' }
 */
import { authorizedDeviceRequest } from './deviceAuthService';

export async function listLinkedDevices(brandConfig, brand) {
  const data = await authorizedDeviceRequest(brandConfig, brand, '/wind/devices/', { method: 'GET' });
  return Array.isArray(data?.devices) ? data.devices : [];
}

export async function revokeLinkedDevice(brandConfig, brand, deviceId) {
  return authorizedDeviceRequest(
    brandConfig,
    brand,
    `/wind/devices/${encodeURIComponent(deviceId)}/revoke/`,
    { method: 'POST' },
  );
}
