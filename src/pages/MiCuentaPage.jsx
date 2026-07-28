import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { useDeviceTime } from '../hooks/useDeviceTime';
import { useTvInitialFocus } from '../hooks/useTvInitialFocus';
import ConfirmModal from '../components/ConfirmModal';
import LinkedDevicesPanel from '../components/account/LinkedDevicesPanel';
import ChangePasswordPanel from '../components/account/ChangePasswordPanel';
import CloseAccountPanel from '../components/account/CloseAccountPanel';
import panaccessService from '../services/panaccessService';
import { isDeviceSessionEnabled } from '../services/deviceAuthService';
import { exitAppBestEffort } from '../utils/tvNavigation';
import { setLoggedOut, getActiveLicense, getCredentials } from '../utils/userSession';
import {
  closeActiveDeviceSession,
  getStoredDeviceToken,
  getStoredDeviceId,
  restoreStoredDeviceSession,
} from '../services/deviceSessionService';
import '../styles/pages/_mi-cuenta.scss';

/**
 * Pantalla "Mi cuenta" (/home/mi-cuenta): reemplaza el pop-up de Cuenta del
 * sidebar. Cambiar contraseña / Dispositivos vinculados / Suscripción /
 * Eliminar cuenta son links 100% configurables por marca (`brand.account.links`,
 * misma forma { enabled, url } que `login.qrRegister`): cada uno se resuelve
 * como un QR (igual patrón que Login) para completar el flujo desde el móvil,
 * ya que en TV no hay forma práctica de abrir un link arbitrario.
 *
 * EXCEPCIÓN nativa: si el brand tiene `login.deviceSession.enabled` (backend
 * propio de "dispositivos vinculados"/cuenta, ver `deviceAuthService.js`) Y
 * no estamos en TV, "Cambiar contraseña", "Dispositivos vinculados" y
 * "Eliminar cuenta" se resuelven con un panel nativo dentro de la misma app
 * en vez del QR -- en TV escribir una contraseña con el control remoto es
 * mala UX, así que ahí se sigue usando el QR sin cambios. "Suscripción" no
 * tiene contrapartida nativa (no forma parte del contrato de este backend)
 * y siempre usa QR.
 */
const NATIVE_ACCOUNT_PANELS = {
  changePassword: ChangePasswordPanel,
  linkedDevices: LinkedDevicesPanel,
  deleteAccount: CloseAccountPanel,
};
export function MiCuentaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { appName, currentBrand } = useBrand();
  const { isTV } = useDevice();
  const { text: clockText } = useDeviceTime({ locale: currentBrand?.ui?.locale, format: 'HH:mm' });

  const osmsEnabled = currentBrand?.features?.osms === true;
  const useNativeAccountFlow = !isTV && isDeviceSessionEnabled(currentBrand);

  const qrItems = useMemo(() => {
    const accountLinks = currentBrand?.account?.links || {};
    const defs = [
      {
        key: 'changePassword',
        label: t('account.changePassword', { defaultValue: 'Cambiar contraseña' }),
        link: accountLinks.changePassword,
        step3: t('account.step3ChangePassword', {
          defaultValue: 'Sigue las instrucciones de tu dispositivo para ingresar tu nueva contraseña.',
        }),
      },
      {
        key: 'linkedDevices',
        label: t('account.linkedDevices', { defaultValue: 'Dispositivos vinculados' }),
        link: accountLinks.linkedDevices,
        step3: t('account.step3LinkedDevices', {
          defaultValue: 'Sigue las instrucciones de tu dispositivo para gestionar tus dispositivos vinculados.',
        }),
      },
      {
        key: 'subscription',
        label: t('account.subscription', { defaultValue: 'Suscripción' }),
        link: accountLinks.subscription,
        step3: t('account.step3Subscription', {
          defaultValue: 'Sigue las instrucciones de tu dispositivo para gestionar tu suscripción.',
        }),
      },
      {
        key: 'deleteAccount',
        label: t('account.deleteAccount', { defaultValue: 'Eliminar cuenta' }),
        link: accountLinks.deleteAccount,
        step3: t('account.step3DeleteAccount', {
          defaultValue: 'Sigue las instrucciones de tu dispositivo para eliminar tu cuenta.',
        }),
        danger: true,
      },
    ];
    // enabled !== false: si la marca no define el link todavía, se muestra igual
    // (con aviso "no configurado") en vez de desaparecer silenciosamente.
    return defs.filter((item) => item.link?.enabled !== false);
  }, [currentBrand, t]);

  const [activeKey, setActiveKey] = useState(() => qrItems[0]?.key || 'about');
  const [confirmAction, setConfirmAction] = useState(null); // 'logout' | 'exit' | null
  const [qrImageSrc, setQrImageSrc] = useState('');

  useEffect(() => {
    if (!qrItems.some((i) => i.key === activeKey) && activeKey !== 'about') {
      setActiveKey(qrItems[0]?.key || 'about');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrItems]);

  const activeItem = qrItems.find((i) => i.key === activeKey) || null;
  const activeUrl = activeItem?.link?.url || '';

  useTvInitialFocus('.mi-cuenta-page', [qrItems.length]);

  useEffect(() => {
    if (!activeUrl) {
      setQrImageSrc('');
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(activeUrl, { width: 256, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrImageSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrImageSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [activeUrl]);

  const aboutRows = useMemo(() => {
    const cred = getCredentials();
    const username = cred?.username ? String(cred.username) : '';
    const active = getActiveLicense();
    const card = active?.licenseKey ? String(active.licenseKey) : '';
    const brand = currentBrand?.brand || '';
    const version =
      currentBrand?.version || import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_VERSION || '';
    const developedBy = currentBrand?.developedBy ? String(currentBrand.developedBy) : '';
    const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone || '';
    return [
      [t('account.aboutApp', { defaultValue: 'App' }), appName],
      [t('account.aboutBrand', { defaultValue: 'Marca' }), brand],
      [t('account.aboutVersion', { defaultValue: 'Versión' }), version],
      [t('account.aboutUsername', { defaultValue: 'Usuario' }), username],
      [t('account.aboutSmartcard', { defaultValue: 'Smartcard' }), card],
      [t('account.aboutDevelopedBy', { defaultValue: 'Desarrollado por' }), developedBy],
      [t('account.aboutTimezone', { defaultValue: 'Zona horaria' }), timezone],
    ].filter(([, value]) => Boolean(value));
  }, [appName, currentBrand, t]);

  const handleRefresh = () => {
    navigate(`/preload?redirect=${encodeURIComponent('/home/mi-cuenta')}`);
  };

  const handleLogout = async () => {
    try {
      await panaccessService.logout?.();
    } catch {
      // noop
    }
    // `setLoggedOut()` borra TODO el storage de esta marca (credenciales,
    // licencias, y también `deviceSession.deviceToken`/`deviceId`, que
    // viven bajo el mismo prefijo `{brand}.*`) -- sin nada que lo
    // preserve, el próximo login en este mismo dispositivo no tenía
    // ningún `device_token` para reenviar en `register_device`, y el
    // backend creaba un `DeviceSession` nuevo cada vez que el usuario
    // cerraba y volvía a iniciar sesión, aunque fuera literalmente el
    // mismo navegador (reporte real de prueba). Se guarda antes de
    // borrar y se restaura después -- un logout normal en el mismo
    // dispositivo debe poder refrescar el mismo registro en el próximo
    // login, no duplicarlo. (Distinto de `clearSessionBeforeNewLogin()`,
    // usado cuando OTRO usuario va a loguearse en este dispositivo: ahí sí
    // corresponde borrarlo, para no arrastrar el device_token de la
    // cuenta anterior.)
    const brand = currentBrand?.brand;
    const deviceToken = getStoredDeviceToken(brand);
    const deviceId = getStoredDeviceId(brand);
    closeActiveDeviceSession();
    setLoggedOut();
    restoreStoredDeviceSession({ token: deviceToken, id: deviceId }, brand);
    navigate('/login', { replace: true });
  };

  const handleExit = () => {
    exitAppBestEffort();
  };

  return (
    <section className="mi-cuenta-page" aria-label={t('account.title', { defaultValue: 'Mi cuenta' })}>
      <ConfirmModal
        open={confirmAction === 'logout'}
        title={t('settings.logoutConfirmTitle', { defaultValue: 'Cerrar sesión' })}
        message={t('settings.logoutConfirmMessage', { defaultValue: '¿Deseas cerrar sesión en este dispositivo?' })}
        confirmText={t('settings.confirm', { defaultValue: 'Confirmar' })}
        cancelText={t('settings.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={() => {
          setConfirmAction(null);
          handleLogout();
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmModal
        open={confirmAction === 'exit'}
        title={t('settings.exitConfirmTitle', { defaultValue: 'Salir' })}
        message={t('settings.exitConfirmMessage', { defaultValue: '¿Deseas salir de la aplicación?' })}
        confirmText={t('settings.confirm', { defaultValue: 'Confirmar' })}
        cancelText={t('settings.cancel', { defaultValue: 'Cancelar' })}
        onConfirm={() => {
          setConfirmAction(null);
          handleExit();
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <nav className="mi-cuenta-sidebar" aria-label={t('account.title', { defaultValue: 'Mi cuenta' })}>
          <h2 className="mi-cuenta-sidebar__title">{t('account.title', { defaultValue: 'Mi cuenta' })}</h2>

          <div className="mi-cuenta-sidebar__group">
            {qrItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`mi-cuenta-item${activeKey === item.key ? ' active' : ''}${item.danger ? ' danger' : ''}`}
                onClick={() => setActiveKey(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mi-cuenta-sidebar__divider" role="separator" aria-hidden="true" />

          <div className="mi-cuenta-sidebar__group">
            <button
              type="button"
              className="mi-cuenta-item"
              onClick={() => navigate('/home/control-parental')}
            >
              {t('account.advancedSettings', { defaultValue: 'Configuración avanzada' })}
            </button>
            {osmsEnabled ? (
              <button type="button" className="mi-cuenta-item" onClick={() => navigate('/home/osms')}>
                {t('account.messages', { defaultValue: 'Mensajes' })}
              </button>
            ) : null}
            <button
              type="button"
              className={`mi-cuenta-item${activeKey === 'about' ? ' active' : ''}`}
              onClick={() => setActiveKey('about')}
            >
              {t('account.about', { defaultValue: 'Acerca de la App' })}
            </button>
            <button type="button" className="mi-cuenta-item" onClick={handleRefresh}>
              {t('account.refresh', { defaultValue: 'Refrescar' })}
            </button>
            <button type="button" className="mi-cuenta-item" onClick={() => setConfirmAction('logout')}>
              {t('common.logout', { defaultValue: 'Cerrar sesión' })}
            </button>
            {isTV && (
              <button type="button" className="mi-cuenta-item danger" onClick={() => setConfirmAction('exit')}>
                {t('common.exit', { defaultValue: 'Salir' })}
              </button>
            )}
          </div>
        </nav>

        <div className="mi-cuenta-content">
          <div className="mi-cuenta-clock">{clockText}</div>

          {activeItem ? (
            <>
              <h1 className="mi-cuenta-content__title">{activeItem.label}</h1>
              {useNativeAccountFlow && NATIVE_ACCOUNT_PANELS[activeItem.key] ? (
                (() => {
                  const NativePanel = NATIVE_ACCOUNT_PANELS[activeItem.key];
                  return <NativePanel brandConfig={currentBrand} brand={currentBrand?.brand} />;
                })()
              ) : (
                <div className="mi-cuenta-qr-row">
                  <div className="mi-cuenta-qr-box">
                    {activeUrl ? (
                      qrImageSrc ? (
                        <img src={qrImageSrc} alt={activeItem.label} className="mi-cuenta-qr-img" />
                      ) : null
                    ) : (
                      <div className="mi-cuenta-qr-empty">
                        {t('account.notConfigured', { defaultValue: 'Esta marca aún no configuró este enlace.' })}
                      </div>
                    )}
                  </div>
                  <ol className="mi-cuenta-steps">
                    <li className="mi-cuenta-step">
                      <span className="mi-cuenta-step__num">1</span>
                      <span>{t('account.step1', { defaultValue: 'Abra la cámara de su smartphone o tablet.' })}</span>
                    </li>
                    <li className="mi-cuenta-step">
                      <span className="mi-cuenta-step__num">2</span>
                      <span>{t('account.step2', { defaultValue: 'Escanea el código QR que aparece en pantalla.' })}</span>
                    </li>
                    <li className="mi-cuenta-step">
                      <span className="mi-cuenta-step__num">3</span>
                      <span>{activeItem.step3}</span>
                    </li>
                  </ol>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="mi-cuenta-content__title">{t('account.about', { defaultValue: 'Acerca de la App' })}</h1>
              <ul className="mi-cuenta-about-list">
                {aboutRows.map(([label, value]) => (
                  <li key={label} className="mi-cuenta-about-row">
                    <span className="mi-cuenta-about-row__label">{label}</span>
                    <span className="mi-cuenta-about-row__value">{value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
    </section>
  );
}

export default MiCuentaPage;
