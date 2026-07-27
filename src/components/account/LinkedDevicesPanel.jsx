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
import '../../styles/components/_account-security.scss';

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
            {devices.map((d) => (
              <li key={d.id} className="linked-devices-row">
                <div className="linked-devices-row__info">
                  <span className="linked-devices-row__type">
                    {DEVICE_TYPE_LABELS[d.device_type] ||
                      d.device_type ||
                      t('account.linkedDevicesUnknownType', { defaultValue: 'Dispositivo' })}
                  </span>
                  {d.device_model && <span className="linked-devices-row__model">{d.device_model}</span>}
                  <span className="linked-devices-row__meta">
                    {t('account.linkedDevicesLastSeen', { defaultValue: 'Última conexión' })}:{' '}
                    {formatDate(d.last_seen_at)}
                  </span>
                </div>
                <button
                  type="button"
                  className="account-security-btn account-security-btn--danger"
                  onClick={() => setPendingRevokeId(d.id)}
                  disabled={revokingId === d.id}
                >
                  {revokingId === d.id
                    ? t('common.loading')
                    : t('account.linkedDevicesRevoke', { defaultValue: 'Revocar' })}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default LinkedDevicesPanel;
