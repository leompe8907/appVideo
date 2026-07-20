import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBrand } from '../../contexts/BrandContext';
import { useDevice } from '../../contexts/DeviceContext';
import { useOsmsStore } from '../../store/osmsStore';
import { previewText } from '../../utils/osmsFormat';
import { FocusableButton } from '../navigation/FocusableButton';
import AppIcon from '../AppIcon';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';
import '../../styles/pages/_osms.scss';

export function OsmsNotificationHost() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { isTV } = useDevice();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('osms-notification');

  const enabled = Boolean(currentBrand?.features?.osms);
  const pendingNotification = useOsmsStore((s) => s.pendingNotification);
  const dismissOsmsNotification = useOsmsStore((s) => s.dismissOsmsNotification);

  const open =
    enabled &&
    Boolean(pendingNotification) &&
    pathname !== '/home/osms';

  // Navegación (LEFT/RIGHT por geometría entre "Ver"/"Descartar", BACK descarta)
  // delegada a una zona de FocusManager, igual que otros modales.
  useEffect(() => {
    if (!open) return undefined;
    const zoneId = zoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: rootRef.current,
      onBack: () => {
        dismissOsmsNotification();
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [open, dismissOsmsNotification]);

  useEffect(() => {
    if (!open || !isTV) return undefined;
    const tm = setTimeout(() => {
      focusElementSafe(document.getElementById('osms-notification-view'));
    }, 50);
    return () => clearTimeout(tm);
  }, [open, isTV, pendingNotification?.id]);

  if (!open) return null;

  const preview = previewText(pendingNotification.message, 100) || t('osms.noMessage');

  const goToOsms = () => {
    const openOsmId = pendingNotification.id;
    dismissOsmsNotification();
    navigate('/home/osms', { state: { openOsmId } });
  };

  return createPortal(
    <div
      ref={rootRef}
      className="osms-notification-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="osms-notification-title"
    >
      <div className="osms-notification" onClick={(e) => e.stopPropagation()}>
        <div className="osms-notification__body">
          <div className="osms-notification__icon" aria-hidden="true">
            <AppIcon name="mail" size={26} />
          </div>
          <div className="osms-notification__text">
            <h2 id="osms-notification-title" className="osms-notification__title">
              {t('osms.notificationTitle')}
            </h2>
            <p className="osms-notification__preview">{preview}</p>
          </div>
        </div>
        <div className="osms-notification__actions">
          <FocusableButton
            type="button"
            className="osms-notification__btn osms-notification__btn--primary"
            id="osms-notification-view"
            onClick={goToOsms}
          >
            {t('osms.notificationView')}
          </FocusableButton>
          <FocusableButton
            type="button"
            className="osms-notification__btn"
            id="osms-notification-dismiss"
            onClick={() => dismissOsmsNotification()}
          >
            {t('osms.notificationDismiss')}
          </FocusableButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default OsmsNotificationHost;
