import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableInput } from '../components/navigation/FocusableInput';
import { FocusableButton } from '../components/navigation/FocusableButton';
import { getInitialRoute } from '../utils/navigation';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import { loginAndActivateLicense } from '../services/loginFlow';
import { classifyError, ERROR_TYPES } from '../cv/errorClassifier';
import { getActiveLicense } from '../utils/userSession';
import '../styles/components/_login.scss';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, appName, isLoading, getImage } = useBrand();
  const { isTV } = useDevice();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrImageSrc, setQrImageSrc] = useState('');
  const [qrError, setQrError] = useState('');

  console.log(`🖥️ [DEVICE] Modo: ${isTV ? 'TV' : 'PC'}`);

  const qrRegisterConfig = currentBrand?.qrRegister;
  const qrRegisterEnabled = !!qrRegisterConfig?.enabled;
  const qrRegisterUrl = typeof qrRegisterConfig?.url === 'string' ? qrRegisterConfig.url.trim() : '';
  const canShowQrRegister = qrRegisterEnabled && qrRegisterUrl.length > 0;
  const userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  const hasSamsungRuntime = typeof window !== 'undefined' && (!!window.tizen || !!window.webapis);
  const hasLgRuntime = typeof window !== 'undefined' && (!!window.webOS || !!window.PalmSystem);
  const isSamsungTv = isTV && (hasSamsungRuntime || userAgent.includes('tizen') || userAgent.includes('samsung'));
  const isLgTv = isTV && (hasLgRuntime || userAgent.includes('webos') || userAgent.includes('netcast') || userAgent.includes('lg'));
  const shouldShowQrModal = isSamsungTv || isLgTv;

  // Establecer focus inicial en TV al cargar la página
  useEffect(() => {
    if (isTV) {
      // Pequeño delay para asegurar que todos los componentes estén montados y registrados
      const timer = setTimeout(() => {
        // Usar la API de la librería para establecer focus en el primer input
        const setFocus = SpatialNavigation.setFocus || SpatialNavigation.focus || SpatialNavigation.default?.setFocus;
        
        if (setFocus && typeof setFocus === 'function') {
          // Establecer focus en el primer input usando su focusKey
          setFocus('login-username');
        } else {
          // Si no hay setFocus, intentar usar focus nativo del DOM
          const usernameInput = document.getElementById('username');
          if (usernameInput) {
            usernameInput.focus();
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isTV]);

  useEffect(() => {
    if (!isQrModalOpen) return;
    if (!canShowQrRegister) {
      setQrError(t('login.registerUnavailable'));
      setQrImageSrc('');
      return;
    }

    let cancelled = false;
    const buildQr = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(qrRegisterUrl, {
          width: 256,
          margin: 1,
        });
        if (cancelled) return;
        setQrImageSrc(dataUrl);
        setQrError('');
      } catch {
        if (cancelled) return;
        setQrImageSrc('');
        setQrError(t('login.registerUnavailable'));
      }
    };

    buildQr();
    return () => {
      cancelled = true;
    };
  }, [isQrModalOpen, canShowQrRegister, qrRegisterUrl, t]);

  useEffect(() => {
    if (!isTV || !isQrModalOpen) return;
    const timer = setTimeout(() => {
      const setFocus = SpatialNavigation.setFocus || SpatialNavigation.focus || SpatialNavigation.default?.setFocus;
      if (setFocus && typeof setFocus === 'function') {
        setFocus('login-register-close');
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isTV, isQrModalOpen]);

  const handleOpenQrModal = () => {
    if (!canShowQrRegister) return;
    if (!shouldShowQrModal) {
      window.location.assign(qrRegisterUrl);
      return;
    }
    setQrError('');
    setQrImageSrc('');
    setIsQrModalOpen(true);
  };

  const handleCloseQrModal = () => {
    setIsQrModalOpen(false);
    if (!isTV) return;
    const setFocus = SpatialNavigation.setFocus || SpatialNavigation.focus || SpatialNavigation.default?.setFocus;
    if (setFocus && typeof setFocus === 'function') {
      setTimeout(() => setFocus('login-register'), 0);
    }
  };

  // ============================================
  // SUBMIT
  // ============================================

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting || !currentBrand) return;

    setIsSubmitting(true);
    setError('');

    try {
      await loginAndActivateLicense(currentBrand, {
        username: username.trim(),
        password: password.trim(),
      }, {
        autoActivateLicense: true,
        // Si la tarjeta está en uso, intenta activar otra disponible.
        failIfInUse: true,
        activationRecursive: true,
        storeClientConfig: true,
        storeLicenses: true,
      });

      setTimeout(() => {
        setIsSubmitting(false);
        const active = getActiveLicense?.();
        const hasActiveLicense = !!active?.licenseKey;
        const skipSmartcard = !currentBrand?.features?.profiles && hasActiveLicense;
        navigate(skipSmartcard ? '/home/bouquets' : getInitialRoute(currentBrand));
      }, 400);

    } catch (err) {
      setTimeout(() => {
        setIsSubmitting(false);
        const errorInfo = err.errorInfo || classifyError(err);
        let messageToShow = t('login.errorGeneric');

        switch (errorInfo.type) {
          case ERROR_TYPES.NETWORK:
            messageToShow = t('login.errorNetwork');
            break;
          case ERROR_TYPES.TIMEOUT:
            messageToShow = t('login.errorTimeout');
            break;
          case ERROR_TYPES.SERVER:
            messageToShow = t('login.errorServer');
            break;
          case ERROR_TYPES.AUTH:
            messageToShow = t('login.errorAuth');
            break;
          default:
            messageToShow = errorInfo.userMessage || err.message || t('login.errorGeneric');
        }
        setError(messageToShow);
      }, 1000);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (isLoading || !currentBrand) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  const logoPath = getImage('logo.png');
  const backgroundPath = currentBrand.assets?.background || getImage('background.png');

  return (
    <div 
      className="panaccess-login"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="login-brand-section">
        {logoPath && <img src={logoPath} alt={appName} className="brand-logo" />}
      </div>

      <div className="login-card">
        <h2>{t('login.title')}</h2>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="form-group">
            <label htmlFor="username">{t('login.user')}</label>
            <FocusableInput
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('login.userPlaceholder')}
              disabled={isSubmitting}
              autoComplete="username"
              required
              focusKey="login-username"
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <div className="password-row">
              <FocusableInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
                focusKey="login-password"
              />
              <FocusableButton
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                focusKey="login-password-toggle"
              >
                {showPassword ? '🙈' : '👁️'}
              </FocusableButton>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <FocusableButton 
            type="submit" 
            disabled={isSubmitting}
            className="login-button"
            focusKey="login-submit"
            onEnterPress={() => {
              // En TV, ejecutar el submit del formulario cuando se presiona Enter
              if (isTV) {
                handleSubmit();
              }
            }}
          >
            {isSubmitting ? t('login.submitting') : t('login.submit')}
          </FocusableButton>

          {qrRegisterEnabled && (
            <div className="register-section">
              <p className="register-hint">{t('login.registerHint')}</p>
              <FocusableButton
                type="button"
                className="register-button"
                focusKey="login-register"
                onClick={handleOpenQrModal}
                onEnterPress={() => {
                  if (isTV) {
                    handleOpenQrModal();
                  }
                }}
              >
                {t('login.register')}
              </FocusableButton>
            </div>
          )}
        </form>
      </div>

      {isQrModalOpen && (
        <div className="register-modal-backdrop">
          <div className="register-modal">
            <h3>{t('login.registerTitle')}</h3>
            <p>{t('login.registerHint')}</p>

            {qrImageSrc ? (
              <img src={qrImageSrc} alt={t('login.register')} className="register-qr-image" />
            ) : (
              <div className="register-qr-placeholder">{qrError || t('common.loading')}</div>
            )}

            <FocusableButton
              type="button"
              className="register-close-button"
              focusKey="login-register-close"
              onClick={handleCloseQrModal}
              onEnterPress={() => {
                if (isTV) {
                  handleCloseQrModal();
                }
              }}
            >
              {t('common.close')}
            </FocusableButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
