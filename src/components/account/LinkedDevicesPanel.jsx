/**
 * Panel nativo de "dispositivos vinculados" (listar/revocar). Solo se
 * monta en PC/web cuando el brand tiene `login.deviceSession.enabled`
 * (ver `MiCuentaPage.jsx`) -- en TV o brands sin este backend se sigue
 * usando el QR existente, sin cambios.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../ConfirmModal';
import { listLinkedDevices, revokeLinkedDevice } from '../../services/linkedDevicesService';
import {
  getStoredDeviceId,
  setOnDeviceRegistered,
  setOnDeviceListChanged,
} from '../../services/deviceSessionService';
// Los estilos de este panel viven en styles/pages/_mi-cuenta.scss (importado
// desde MiCuentaPage.jsx), no acá -- ver el comentario en ese archivo sobre
// por qué (chunk de CSS separado que se rompía en el build de producción).

const DEVICE_TYPE_LABELS = {
  web: 'PC / Web',
  lg: 'LG (webOS)',
  samsung: 'Samsung (Tizen)',
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export function LinkedDevicesPanel({ brandConfig, brand }) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingRevokeId, setPendingRevokeId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [actionError, setActionError] = useState('');
  // `id` que guardó este mismo dispositivo al registrarse (ver
  // `deviceSessionService.js`) -- antes `device_registered` no devolvía
  // ningún id, así que era imposible saber cuál fila de esta lista
  // corresponde al dispositivo que se está usando ahora mismo.
  //
  // Se lee con `useState` (no una simple constante) y se vuelve a leer
  // cuando `setOnDeviceRegistered` avisa que terminó un registro, porque
  // el `register_device` de este dispositivo (WS, se dispara una sola vez
  // al hacer login, sin que nada lo espere) puede terminar DESPUÉS de que
  // este panel ya cargó su lista -- de lo contrario `selfDeviceId` se
  // quedaba con el valor vacío/viejo que había en localStorage al montar
  // el componente, aunque el registro terminara un instante después
  // (reporte real: en varias ventanas abiertas casi al mismo tiempo, solo
  // la que ya llevaba más rato mostraba "Cerrar sesión aquí").
  const [selfDeviceId, setSelfDeviceId] = useState(() => getStoredDeviceId(brand));

  useEffect(() => {
    const handleRegistered = () => setSelfDeviceId(getStoredDeviceId(brand));
    setOnDeviceRegistered(handleRegistered);
    return () => setOnDeviceRegistered(null);
  }, [brand]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const list = await listLinkedDevices(brandConfig, brand);
      setDevices(list);
    } catch (err) {
      setLoadError(
        err?.message ||
          t('account.linkedDevicesError', {
            defaultValue: 'No se pudieron cargar los dispositivos vinculados.',
          }),
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandConfig, brand]);

  useEffect(() => {
    load();
  }, [load]);

  // `device_list_changed` (ver deviceSessionService.js): otro dispositivo
  // de la misma cuenta revocó uno o registró uno nuevo mientras este panel
  // seguía abierto -- antes esta lista solo se actualizaba apretando
  // "Actualizar" a mano (reporte real: revocar desde un dispositivo dejaba
  // la lista del otro mostrando el conteo viejo indefinidamente).
  useEffect(() => {
    setOnDeviceListChanged(() => load());
    return () => setOnDeviceListChanged(null);
  }, [load]);

  const handleRevoke = async (id) => {
    setPendingRevokeId(null);
    setRevokingId(id);
    setActionError('');
    try {
      const result = await revokeLinkedDevice(brandConfig, brand, id);
      if (!result?.ok) {
        throw new Error(
          t('account.linkedDevicesRevokeError', { defaultValue: 'No se pudo revocar el dispositivo.' }),
        );
      }
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setActionError(
        err?.message ||
          t('account.linkedDevicesRevokeError', { defaultValue: 'No se pudo revocar el dispositivo.' }),
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="account-security-panel">
      <ConfirmModal
        open={pendingRevokeId != null}
        title={t('account.linkedDevicesRevokeConfirmTitle', { defaultValue: 'Revocar dispositivo' })}
        message={t('account.linkedDevicesRevokeConfirmMessage', {
          defaultValue: 'Este dispositivo dejará de tener acceso a tu cuenta. ¿Deseas continuar?',
        })}
        confirmText={t('settings.confirm', { defaultValue: 'Confirmar' })}
        cancelText={t('settings.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={() => handleRevoke(pendingRevokeId)}
        onCancel={() => setPendingRevokeId(null)}
      />

      <div className="account-security-panel__toolbar">
        <button
          type="button"
          className="account-security-btn account-security-btn--ghost"
          onClick={load}
          disabled={isLoading}
        >
          {t('account.linkedDevicesRefresh', { defaultValue: 'Actualizar' })}
        </button>
      </div>

      {isLoading ? (
        <div className="account-security-loading">{t('common.loading')}</div>
      ) : loadError ? (
        <div className="account-security-error">{loadError}</div>
      ) : devices.length === 0 ? (
        <div className="account-security-empty">
          {t('account.linkedDevicesEmpty', { defaultValue: 'No tienes dispositivos vinculados todavía.' })}
        </div>
      ) : (
        <>
          {actionError && <div className="account-security-error">{actionError}</div>}
          <ul className="linked-devices-list">
            {devices.map((d) => {
              const isSelf = selfDeviceId && String(d.id) === String(selfDeviceId);
              return (
                <li key={d.id} className="linked-devices-row">
                  <div className="linked-devices-row__info">
                    <span className="linked-devices-row__type">
                      {DEVICE_TYPE_LABELS[d.device_type] ||
                        d.device_type ||
                        t('account.linkedDevicesUnknownType', { defaultValue: 'Dispositivo' })}
                      {isSelf && (
                        <span className="linked-devices-row__self-badge">
                          {t('account.linkedDevicesSelfBadge', { defaultValue: 'Este dispositivo' })}
                        </span>
                      )}
                    </span>
                    {d.device_model && <span className="linked-devices-row__model">{d.device_model}</span>}
                    <span className="linked-devices-row__meta">
                      {t('account.linkedDevicesLastSeen', { defaultValue: 'Última conexión' })}:{' '}
                      {formatDate(d.last_seen_at)}
                    </span>
                    {/* Ubicación aproximada por IP (MaxMind GeoLite2, ver
                        wind/utils/geo_lookup.py) -- solo informativa, no
                        siempre disponible (IP privada/VPN/base no
                        configurada del lado del backend), por eso se oculta
                        del todo si no vino ninguno de los dos campos. */}
                    {(d.city || d.country) && (
                      <span className="linked-devices-row__meta linked-devices-row__location">
                        {[d.city, d.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="account-security-btn account-security-btn--danger"
                    onClick={() => setPendingRevokeId(d.id)}
                    disabled={revokingId === d.id}
                  >
                    {revokingId === d.id
                      ? t('common.loading')
                      : isSelf
                        ? t('account.linkedDevicesLogoutHere', { defaultValue: 'Cerrar sesión aquí' })
                        : t('account.linkedDevicesRevoke', { defaultValue: 'Revocar' })}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default LinkedDevicesPanel;
