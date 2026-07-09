import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableInput } from '../components/navigation/FocusableInput';
import { FocusableButton } from '../components/navigation/FocusableButton';
import { resolvePostLoginRoute } from '../utils/navigation';
import { clearSessionBeforeNewLogin, loginAndActivateLicense } from '../services/loginFlow';
import { classifyError, ERROR_TYPES } from '../cv/errorClassifier';
import { useUdidLoginFlow } from '../hooks/useUdidLoginFlow';
import { LOGIN_FOCUS_IDS, useLoginTvNavigation } from '../hooks/useLoginTvNavigation';
import { getFacebookSocialPostUrl, getGoogleSocialPostUrl } from '../utils/socialAuthUrls';
import { exchangeGoogleCredentialWithBackend } from '../services/googleSocialLogin';
import {
  exchangeFacebookAccessTokenWithBackend,
  getFacebookAccessToken,
} from '../services/facebookSocialLogin';
import { preloadImage } from '../utils/assetLoader';
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
  const [isLoginBgReady, setIsLoginBgReady] = useState(false);

  const loginFormRef = useRef(null);

  const qrRegisterConfig = currentBrand?.login?.qrRegister || currentBrand?.qrRegister;
  const qrRegisterEnabled = !!qrRegisterConfig?.enabled;
  const qrRegisterUrl = typeof qrRegisterConfig?.url === 'string' ? qrRegisterConfig.url.trim() : '';
  const canShowQrRegister = qrRegisterEnabled && qrRegisterUrl.length > 0;
  const forgotPasswordConfig = currentBrand?.login?.forgotPassword;
  const forgotPasswordUrl =
    typeof forgotPasswordConfig?.url === 'string' ? forgotPasswordConfig.url.trim() : '';
  const canShowForgotPassword =
    forgotPasswordConfig?.enabled === true && forgotPasswordUrl.length > 0;
  // En TV siempre usamos modal (redirigir es peor UX y muchos runtimes no se detectan como LG/Samsung).
  const shouldShowQrModal = isTV;
  const udidLoginConfig = currentBrand?.login?.udid || currentBrand?.udidLogin;
  const effectiveUdidConfig = {
    ...udidLoginConfig,
    baseUrl: udidLoginConfig?.baseUrl || currentBrand?.api?.baseUrl || '',
    wsUrl: udidLoginConfig?.wsUrl || currentBrand?.api?.wsUrl || '',
  };

  const handleCloseQrModal = useCallback(() => {
    setIsQrModalOpen(false);
  }, []);

  const handleUdidCredentials = async (credentials) => {
    clearSessionBeforeNewLogin();
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

    navigate(resolvePostLoginRoute(currentBrand));
  };

  const udidFlow = useUdidLoginFlow({
    config: effectiveUdidConfig,
    appName,
    onCredentials: handleUdidCredentials,
    t,
  });

  const handleCloseUdidModal = useCallback(() => {
    udidFlow.cancel();
    setIsUdidModalOpen(false);
  }, [udidFlow]);

  useLoginTvNavigation({
    isTV,
    loginFormRef,
    isQrModalOpen,
    isUdidModalOpen,
    isSubmitting,
    qrRegisterEnabled,
    forgotPasswordEnabled: canShowForgotPassword,
    udidEnabled: !!effectiveUdidConfig?.enabled,
    googleEnabled: !!currentBrand?.login?.socialLogin?.google?.enabled,
    facebookEnabled: !!currentBrand?.login?.socialLogin?.facebook?.enabled,
    onCloseQrModal: handleCloseQrModal,
    onCloseUdidModal: handleCloseUdidModal,
  });

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

  const handleOpenForgotPassword = () => {
    if (!canShowForgotPassword) return;
    window.location.assign(forgotPasswordUrl);
  };

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

  const handleOpenUdidModal = () => {
    setIsUdidModalOpen(true);
    udidFlow.start();
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

        clearSessionBeforeNewLogin();
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

        navigate(resolvePostLoginRoute(currentBrand));
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
      clearSessionBeforeNewLogin();
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
        navigate(resolvePostLoginRoute(currentBrand));
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

  const logoPath = currentBrand ? getImage('logo.png') : '';
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

  const backgroundPath = currentBrand
    ? (hasCustomLoginBg && loginBgAssetPath
        ? getImage(loginBgAssetPath)
        : (currentBrand.assets?.background || getImage('background.png')))
    : '';

  // Precargar el background para evitar que se "pinte por partes" mientras se descarga/decodifica.
  // Si el preload falla, igual mostramos el fondo para no bloquear la pantalla.
  useEffect(() => {
    let cancelled = false;
    setIsLoginBgReady(false);
    if (!backgroundPath) {
      setIsLoginBgReady(true);
      return () => {
        cancelled = true;
      };
    }
    preloadImage(backgroundPath)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setIsLoginBgReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [backgroundPath]);

  if (isLoading || !currentBrand) {
    return <div className="loading">{t('common.loading')}</div>;
  }

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
  // Si true, mantenemos el diseño "fallback" pero el click lo maneja GoogleLogin (invisible encima).
  const preferCustomGoogleButton = googleSocial?.preferCustomButton === true;
  // Opción A: si Google está habilitado, mostrar SIEMPRE un botón fallback
  // cuando no se pueda renderizar GoogleOAuth (mismo look/UX en TV y PC).
  const showGoogleFallbackButton = showGoogle && !showGoogleOAuth;
  const showAnySocial = showGoogleOAuth || showGoogleFallbackButton || showFacebook;

  const handleFacebookClick = () => {
    // Implementación REST: obtener access_token (FB SDK) y hacer POST al backend.
    (async () => {
      if (isSubmitting || !currentBrand) return;
      setError('');
      setIsSubmitting(true);

      try {
        const url = getFacebookSocialPostUrl(currentBrand);
        if (!url) {
          setError(t('login.socialBackendMissing'));
          return;
        }

        const appId =
          (typeof facebookSocial?.accessToken === 'string' ? facebookSocial.accessToken.trim() : '') ||
          '';
        if (!appId) {
          setError(t('login.socialNotAvailable'));
          return;
        }

        const fbAccessToken = await getFacebookAccessToken(appId);
        const data = await exchangeFacebookAccessTokenWithBackend(url, fbAccessToken);

        const pc = data.panaccess_credentials;
        const login1 = pc?.login1 != null ? String(pc.login1).trim() : '';
        const pwd = pc?.password != null ? String(pc.password) : '';
        if (!login1 || !pwd) {
          throw new Error(t('login.errorGeneric'));
        }

        clearSessionBeforeNewLogin();
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

        navigate(resolvePostLoginRoute(currentBrand));
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
    })();
  };

  const loginShell = (
    <div 
      className="panaccess-login"
      style={isLoginBgReady && backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      <div className="login-card">
        {logoPath && <img src={logoPath} alt={appName} className="brand-logo" />}
        <h2 className="login-welcome">{t('login.title')}</h2>

        <form onSubmit={handleSubmit} ref={loginFormRef} className="login-form">
          <div className="form-group form-group--plain">
            <FocusableInput
              id={LOGIN_FOCUS_IDS.USERNAME}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('login.userPlaceholder')}
              disabled={isSubmitting}
              autoComplete="username"
              required
              aria-label={t('login.user')}
            />
          </div>

          <div className="form-group form-group--plain">
            <div className="password-field">
              <FocusableInput
                id={LOGIN_FOCUS_IDS.PASSWORD}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
                aria-label={t('login.password')}
              />
              <FocusableButton
                type="button"
                className="password-toggle password-toggle--inline"
                onClick={() => setShowPassword(!showPassword)}
                id={LOGIN_FOCUS_IDS.PASSWORD_TOGGLE}
                tabIndex={0}
                aria-label={showPassword ? t('login.hidePassword', { defaultValue: 'Ocultar contraseña' }) : t('login.showPassword', { defaultValue: 'Mostrar contraseña' })}
              >
                <span className={`password-toggle__icon${showPassword ? ' is-visible' : ''}`} aria-hidden="true" />
              </FocusableButton>
            </div>
          </div>

          {canShowForgotPassword && (
            <div className="login-forgot-row">
              <FocusableButton
                type="button"
                className="login-text-link login-forgot-password"
                onClick={handleOpenForgotPassword}
                id={LOGIN_FOCUS_IDS.FORGOT_PASSWORD}
                tabIndex={0}
                data-tv-nav="login-actions"
              >
                {t('login.forgotPassword')}
              </FocusableButton>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <FocusableButton
            type="submit"
            disabled={isSubmitting}
            className="login-button"
            id={LOGIN_FOCUS_IDS.SUBMIT}
            tabIndex={isSubmitting ? -1 : 0}
            data-tv-nav="login-actions"
          >
            {isSubmitting ? t('login.submitting') : t('login.submit')}
          </FocusableButton>

          {canShowQrRegister && (
            <p className="login-subscribe-prompt">
              {t('login.noAccountYet')}{' '}
              <FocusableButton
                type="button"
                className="login-text-link login-subscribe-link"
                onClick={handleOpenQrModal}
                id={LOGIN_FOCUS_IDS.SUBSCRIBE}
                tabIndex={0}
                data-tv-nav="login-actions"
              >
                {t('login.subscribeHere')}
              </FocusableButton>
            </p>
          )}

          {effectiveUdidConfig?.enabled && (
            <div className="login-udid-section">
              <FocusableButton
                type="button"
                className="login-secondary-button udid-button"
                onClick={handleOpenUdidModal}
                id={LOGIN_FOCUS_IDS.UDID}
                tabIndex={0}
                data-tv-nav="login-actions"
              >
                {t('login.udidButton')}
              </FocusableButton>
            </div>
          )}

          {showAnySocial && (
            <>
              <div className="login-divider" aria-hidden="true">
                <span>{t('login.orDivider')}</span>
              </div>
              <div className="social-login">
              {showGoogleOAuth && !preferCustomGoogleButton && (
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
                    theme="filled_black"
                    size="large"
                    shape="rectangular"
                    width="320"
                    text="continue_with"
                    locale={(i18n.language || 'es').replace('_', '-')}
                  />
                </div>
              )}

              {showGoogleOAuth && preferCustomGoogleButton && (
                <div
                  className="google-login-host"
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '100%',
                    opacity: isSubmitting ? 0.65 : 1,
                    pointerEvents: isSubmitting ? 'none' : 'auto',
                  }}
                >
                  {/* Botón visible (diseño fallback). */}
                  <FocusableButton
                    type="button"
                    className="social-button google"
                    tabIndex={0}
                    style={{ width: '100%', pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    <span className="social-button__icon social-button__icon--google" aria-hidden="true" />
                    {t('login.continueWithGoogle')}
                  </FocusableButton>

                  {/* Botón real de Google invisible por encima (captura click). */}
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.001, zIndex: 2 }}>
                    <GoogleLogin
                      onSuccess={handleGoogleCredentialSuccess}
                      onError={() => setError(t('login.googleSignInFailed'))}
                      useOneTap={false}
                      theme="filled_black"
                      size="large"
                      shape="rectangular"
                      width="320"
                      text="continue_with"
                      locale={(i18n.language || 'es').replace('_', '-')}
                    />
                  </div>
                </div>
              )}

              {showGoogleFallbackButton && (
                <FocusableButton
                  type="button"
                  className="social-button google"
                  onClick={() => setError(t('login.socialNotAvailable'))}
                  id="login-social-google"
                  tabIndex={0}
                  data-tv-nav="login-actions"
                >
                  <span className="social-button__icon social-button__icon--google" aria-hidden="true" />
                  {t('login.continueWithGoogle')}
                </FocusableButton>
              )}

              {showFacebook && (
                <FocusableButton
                  type="button"
                  className="social-button facebook"
                  onClick={handleFacebookClick}
                  id="login-social-facebook"
                  tabIndex={0}
                  data-tv-nav="login-actions"
                >
                  <span className="social-button__icon social-button__icon--facebook" aria-hidden="true" />
                  {t('login.continueWithFacebook')}
                </FocusableButton>
              )}
              </div>
            </>
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
              id={LOGIN_FOCUS_IDS.MODAL_CLOSE_QR}
              tabIndex={0}
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
                id={LOGIN_FOCUS_IDS.MODAL_CLOSE_UDID}
                tabIndex={0}
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
