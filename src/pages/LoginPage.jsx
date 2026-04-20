import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableInput } from '../components/navigation/FocusableInput';
import { FocusableButton } from '../components/navigation/FocusableButton';
import { getInitialRoute } from '../utils/navigation';
import { loginAndActivateLicense } from '../services/loginFlow';
import { classifyError, ERROR_TYPES } from '../cv/errorClassifier';
import { getActiveLicense } from '../utils/userSession';
import { useUdidLoginFlow } from '../hooks/useUdidLoginFlow';
import { getGoogleSocialPostUrl } from '../utils/socialAuthUrls';
import { exchangeGoogleCredentialWithBackend } from '../services/googleSocialLogin';
import '../styles/components/_login.scss';

export function LoginPage() {
  const { t, i18n } = useTranslation();
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
  const [isUdidModalOpen, setIsUdidModalOpen] = useState(false);
  const [udidQrImageSrc, setUdidQrImageSrc] = useState('');

  console.log(`🖥️ [DEVICE] Modo: ${isTV ? 'TV' : 'PC'}`);

  const qrRegisterConfig = currentBrand?.login?.qrRegister || currentBrand?.qrRegister;
  const qrRegisterEnabled = !!qrRegisterConfig?.enabled;
  const qrRegisterUrl = typeof qrRegisterConfig?.url === 'string' ? qrRegisterConfig.url.trim() : '';
  const canShowQrRegister = qrRegisterEnabled && qrRegisterUrl.length > 0;
  // En TV siempre usamos modal (redirigir es peor UX y muchos runtimes no se detectan como LG/Samsung).
  const shouldShowQrModal = isTV;
  const udidLoginConfig = currentBrand?.login?.udid || currentBrand?.udidLogin;
  const effectiveUdidConfig = {
    ...udidLoginConfig,
    baseUrl: udidLoginConfig?.baseUrl || currentBrand?.api?.baseUrl || '',
    wsUrl: udidLoginConfig?.wsUrl || currentBrand?.api?.wsUrl || '',
  };

  const handleUdidCredentials = async (credentials) => {
    await loginAndActivateLicense(currentBrand, {
      username: credentials.username,
      password: credentials.password,
    }, {
      autoActivateLicense: !credentials.licenseKey,
      activationRecursive: true,
      // Si está en uso, fallar para poder:
      // - intentar otra licencia libre (autoActivate)
      // - si no hay ninguna libre, caer a /smartcard
      failIfInUse: true,
      storeClientConfig: true,
      storeLicenses: true,
      licenseKey: credentials.licenseKey || undefined,
      pin: credentials.pin || undefined,
    });

    const active = getActiveLicense?.();
    const hasActiveLicense = !!active?.licenseKey;
    if (!hasActiveLicense) {
      navigate('/smartcard');
      return;
    }
    const skipSmartcard = !currentBrand?.features?.profiles && hasActiveLicense;
    navigate(skipSmartcard ? '/home/inicio' : getInitialRoute(currentBrand));
  };

  const udidFlow = useUdidLoginFlow({
    config: effectiveUdidConfig,
    appName,
    onCredentials: handleUdidCredentials,
    t,
  });

  // Establecer focus inicial en TV al cargar la página
  useEffect(() => {
    if (isTV) {
      // Pequeño delay
      const timer = setTimeout(() => {
        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.focus();
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
  }, [isTV, isQrModalOpen]);

  useEffect(() => {
    if (!isUdidModalOpen || !isTV) return;
  }, [isTV, isUdidModalOpen]);

  useEffect(() => {
    if (!isUdidModalOpen || !udidFlow.code) {
      setUdidQrImageSrc('');
      return;
    }
    let cancelled = false;
    const buildUdidQr = async () => {
      try {
        const payload = `${appName}:${udidFlow.code}`;
        const dataUrl = await QRCode.toDataURL(payload, { width: 200, margin: 1 });
        if (cancelled) return;
        setUdidQrImageSrc(dataUrl);
      } catch {
        if (cancelled) return;
        setUdidQrImageSrc('');
      }
    };
    buildUdidQr();
    return () => {
      cancelled = true;
    };
  }, [appName, isUdidModalOpen, udidFlow.code]);

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
  };

  const handleOpenUdidModal = () => {
    setIsUdidModalOpen(true);
    udidFlow.start();
  };

  const handleCloseUdidModal = () => {
    udidFlow.cancel();
    setIsUdidModalOpen(false);
  };

  const formatRemaining = (seconds) => {
    const mm = Math.floor(Math.max(0, seconds) / 60);
    const ss = Math.max(0, seconds) % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const handleGoogleCredentialSuccess = useCallback(
    async (credentialResponse) => {
      const credential = credentialResponse?.credential;
      if (!credential || !currentBrand) return;

      setError('');
      setIsSubmitting(true);
      const url = getGoogleSocialPostUrl(currentBrand);
      if (!url) {
        setError(t('login.socialBackendMissing'));
        setIsSubmitting(false);
        return;
      }

      try {
        const data = await exchangeGoogleCredentialWithBackend(url, credential);
        const pc = data.panaccess_credentials;
        const login1 = pc?.login1 != null ? String(pc.login1).trim() : '';
        const pwd = pc?.password != null ? String(pc.password) : '';
        if (!login1 || !pwd) {
          throw new Error(t('login.googlePanaccessMissing'));
        }

        await loginAndActivateLicense(
          currentBrand,
          { username: login1, password: pwd },
          {
            autoActivateLicense: true,
            failIfInUse: true,
            activationRecursive: true,
            storeClientConfig: true,
            storeLicenses: true,
          },
        );

        const active = getActiveLicense?.();
        const hasActiveLicense = !!active?.licenseKey;
        const skipSmartcard = !currentBrand?.features?.profiles && hasActiveLicense;
        navigate(skipSmartcard ? '/home/inicio' : getInitialRoute(currentBrand));
      } catch (err) {
        const errorInfo = err.errorInfo || classifyError(err);
        let messageToShow = err.message || t('login.errorGeneric');
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
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentBrand, navigate, t],
  );

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
        navigate(skipSmartcard ? '/home/inicio' : getInitialRoute(currentBrand));
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
  const loginBackgroundConfig = currentBrand?.login?.backgroundImage;
  const hasCustomLoginBg = loginBackgroundConfig?.enabled === true;
  const loginBgAssetPathRaw =
    typeof loginBackgroundConfig?.assetPath === 'string'
      ? loginBackgroundConfig.assetPath.trim()
      : '';
  const loginBgAssetPath =
    loginBgAssetPathRaw && !loginBgAssetPathRaw.includes('.')
      ? `${loginBgAssetPathRaw}.png`
      : loginBgAssetPathRaw;

  const backgroundPath = hasCustomLoginBg && loginBgAssetPath
    ? getImage(loginBgAssetPath)
    : (currentBrand.assets?.background || getImage('background.png'));

  const socialLogin = currentBrand?.login?.socialLogin || {};
  const googleSocial = socialLogin.google || {};
  const facebookSocial = socialLogin.facebook || {};
  const showGoogle = googleSocial.enabled === true;
  const showFacebook = facebookSocial.enabled === true;

  const googleClientId =
    (typeof googleSocial.accessToken === 'string' ? googleSocial.accessToken.trim() : '') ||
    (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const googlePostUrl = getGoogleSocialPostUrl(currentBrand);
  const showGoogleOAuth = showGoogle && !isTV && !!googleClientId && !!googlePostUrl;
  const showGoogleMisconfigured = showGoogle && !isTV && !!googleClientId && !googlePostUrl;
  const showAnySocial = showGoogleOAuth || showGoogleMisconfigured || showFacebook;

  const handleFacebookClick = () => {
    const redirectUrl =
      typeof facebookSocial?.redirectUrl === 'string' ? facebookSocial.redirectUrl.trim() : '';
    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }
    setError(t('login.socialNotAvailable'));
  };

  const loginShell = (
    <div 
      className="panaccess-login"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="login-card">
        {logoPath && <img src={logoPath} alt={appName} className="brand-logo" />}
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
              />
              <FocusableButton
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
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
          >
            {isSubmitting ? t('login.submitting') : t('login.submit')}
          </FocusableButton>

          {qrRegisterEnabled && (
            <div className="register-section">
              <p className="register-hint">{t('login.registerHint')}</p>
              <FocusableButton
                type="button"
                className="register-button"
                onClick={handleOpenQrModal}
              >
                {t('login.register')}
              </FocusableButton>
            </div>
          )}

          {effectiveUdidConfig?.enabled && (
            <div className="register-section">
              <p className="register-hint">{t('login.udidHint')}</p>
              <FocusableButton
                type="button"
                className="udid-button"
                onClick={handleOpenUdidModal}
              >
                {t('login.udidButton')}
              </FocusableButton>
            </div>
          )}

          {showAnySocial && (
            <div className="social-login">
              {showGoogleOAuth && (
                <div
                  className="google-login-host"
                  style={{
                    opacity: isSubmitting ? 0.65 : 1,
                    pointerEvents: isSubmitting ? 'none' : 'auto',
                  }}
                >
                  <GoogleLogin
                    onSuccess={handleGoogleCredentialSuccess}
                    onError={() => setError(t('login.googleSignInFailed'))}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    width="384"
                    text="continue_with"
                    locale={(i18n.language || 'es').replace('_', '-')}
                  />
                </div>
              )}

              {showGoogleMisconfigured && (
                <FocusableButton
                  type="button"
                  className="social-button google"
                  onClick={() => setError(t('login.socialBackendMissing'))}
                >
                  {t('login.continueWithGoogle')}
                </FocusableButton>
              )}

              {showFacebook && (
                <FocusableButton
                  type="button"
                  className="social-button facebook"
                  onClick={handleFacebookClick}
                >
                  {t('login.continueWithFacebook')}
                </FocusableButton>
              )}
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
              onClick={handleCloseQrModal}
            >
              {t('common.close')}
            </FocusableButton>
          </div>
        </div>
      )}

      {isUdidModalOpen && (
        <div className="register-modal-backdrop">
          <div className="register-modal">
            <h3>{t('login.udidTitle')}</h3>
            <p>{t('login.udidHint')}</p>

            {!!udidFlow.code && (
              <>
                <div className="udid-code">{udidFlow.code}</div>
                <div className="udid-countdown">{formatRemaining(udidFlow.remainingSeconds)}</div>
                {udidQrImageSrc && (
                  <img src={udidQrImageSrc} alt={t('login.udidButton')} className="register-qr-image" />
                )}
              </>
            )}

            {udidFlow.status === 'requesting_code' && (
              <div className="register-qr-placeholder">{t('login.udidRequesting')}</div>
            )}

            {udidFlow.status === 'reconnecting' && (
              <div className="register-qr-placeholder">{t('login.udidReconnecting')}</div>
            )}

            {(udidFlow.status === 'error' || udidFlow.status === 'expired' || udidFlow.status === 'rate_limited') && (
              <div className="register-qr-placeholder">{udidFlow.error || t('login.udidErrorGeneric')}</div>
            )}

            {udidFlow.status === 'logging_in' && (
              <div className="register-qr-placeholder">{t('login.udidLoggingIn')}</div>
            )}

            <div className="udid-modal-actions">
              {(udidFlow.status === 'error' || udidFlow.status === 'expired' || udidFlow.status === 'rate_limited') && (
                <FocusableButton
                  type="button"
                  className="udid-button"
                  onClick={udidFlow.retry}
                >
                  {t('login.udidRetry')}
                </FocusableButton>
              )}

              <FocusableButton
                type="button"
                className="register-close-button"
                onClick={handleCloseUdidModal}
              >
                {t('common.close')}
              </FocusableButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (showGoogleOAuth) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {loginShell}
      </GoogleOAuthProvider>
    );
  }

  return loginShell;
}

export default LoginPage;
