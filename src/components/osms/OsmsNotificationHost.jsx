import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBrand } from '../../contexts/BrandContext';
import { useDevice } from '../../contexts/DeviceContext';
import { useOsmsStore } from '../../store/osmsStore';
import { previewText } from '../../utils/osmsFormat';
import { getTvActionFromKeyEvent, TV_ACTION } from '../../utils/tvRemote';
import { FocusableButton } from '../navigation/FocusableButton';
import AppIcon from '../AppIcon';
import '../../styles/pages/_osms.scss';

export function OsmsNotificationHost() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { isTV } = useDevice();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const enabled = Boolean(currentBrand?.features?.osms);
  const pendingNotification = useOsmsStore((s) => s.pendingNotification);
  const dismissOsmsNotification = useOsmsStore((s) => s.dismissOsmsNotification);

  const open =
    enabled &&
    Boolean(pendingNotification) &&
    pathname !== '/home/osms';

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const action = getTvActionFromKeyEvent(e);
      if (action === TV_ACTION.BACK || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismissOsmsNotification();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, dismissOsmsNotification]);

  useEffect(() => {
    if (!open || !isTV) return undefined;
    const tm = setTimeout(() => {
      const btn = document.getElementById('osms-notification-view');
      if (btn) btn.focus();
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
