import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableInput } from '../components/navigation/FocusableInput';
import { FocusableButton } from '../components/navigation/FocusableButton';
import { MessageModal } from '../components/MessageModal';
import { resolvePostLoginRoute } from '../utils/navigation';
import { clearSessionBeforeNewLogin, loginAndActivateLicense } from '../services/loginFlow';
import { classifyError, ERROR_TYPES } from '../cv/errorClassifier';
import { useUdidLoginFlow } from '../hooks/useUdidLoginFlow';
import { LOGIN_FOCUS_IDS, useLoginTvNavigation } from '../hooks/useLoginTvNavigation';
import { focusManager, createZoneId } from '../navigation/FocusManager';
import { getFacebookSocialPostUrl, getGoogleSocialPostUrl } from '../utils/socialAuthUrls';
import { exchangeGoogleCredentialWithBackend } from '../services/googleSocialLogin';
import {
  exchangeFacebookAccessTokenWithBackend,
  getFacebookAccessToken,
} from '../services/facebookSocialLogin';
import { isDeviceSessionEnabled } from '../services/deviceAuthService';
import { requestPasswordReset } from '../services/accountSecurityService';
import { preloadImage } from '../utils/assetLoader';
import { LOGIN_SOCIAL_LOGOS } from '../constants/login/socialLogos.js';
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
  const [isForgotQrModalOpen, setIsForgotQrModalOpen] = useState(false);
  const [forgotQrImageSrc, setForgotQrImageSrc] = useState('');
  const [forgotQrError, setForgotQrError] = useState('');
  const [isForgotNativeModalOpen, setIsForgotNativeModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotNativeError, setForgotNativeError] = useState('');
  const [forgotNativeSuccess, setForgotNativeSuccess] = useState(false);
  const [isUdidModalOpen, setIsUdidModalOpen] = useState(false);
  const [udidQrImageSrc, setUdidQrImageSrc] = useState('');
  const [isLoginBgReady, setIsLoginBgReady] = useState(false);

  const loginFormRef = useRef(null);
  const qrModalRootRef = useRef(null);
  const forgotQrModalRootRef = useRef(null);
  const udidModalRootRef = useRef(null);
  const qrZoneIdRef = useRef(null);
  const forgotQrZoneIdRef = useRef(null);
  const udidZoneIdRef = useRef(null);
  if (!qrZoneIdRef.current) qrZoneIdRef.current = createZoneId('login-qr-modal');
  if (!forgotQrZoneIdRef.current) forgotQrZoneIdRef.current = createZoneId('login-forgot-qr-modal');
  if (!udidZoneIdRef.current) udidZoneIdRef.current = createZoneId('login-udid-modal');

  const qrRegisterConfig = currentBrand?.login?.qrRegister || currentBrand?.qrRegister;
  const qrRegisterEnabled = !!qrRegisterConfig?.enabled;
  const qrRegisterUrl = typeof qrRegisterConfig?.url === 'string' ? qrRegisterConfig.url.trim() : '';
  const canShowQrRegister = qrRegisterEnabled && qrRegisterUrl.length > 0;
  const forgotPasswordConfig = currentBrand?.login?.forgotPassword;
  const forgotPasswordUrl =
    typeof forgotPasswordConfig?.url === 'string' ? forgotPasswordConfig.url.trim() : '';
  // origin=app (2026-09-09, ver docs/REDIRECT_OLVIDAR_CONTRASENA_2026-09-09.md
  // en Back-Wind-V2): estos dos caminos (QR de TV, redirect directo en PC)
  // mandan al usuario a la página de "olvidé contraseña" del backend -- se
  // le agrega esta banderita para que, al terminar todo el flujo (después
  // de tocar el link del correo), vuelva a la app/windtv en vez de
  // quedarse en el login de prueba del backend. Inofensivo si `forgotPasswordUrl`
  // apunta a un sistema de otra marca que no sea nuestro backend: un query
  // param que no reconoce simplemente lo ignora.
  const forgotPasswordUrlWithOrigin = forgotPasswordUrl
    ? `${forgotPasswordUrl}${forgotPasswordUrl.includes('?') ? '&' : '?'}origin=app`
    : forgotPasswordUrl;
  // Nativo: si el brand tiene el backend de "dispositivos vinculados"/cuenta
  // (`login.deviceSession.enabled`, ver `deviceAuthService.js`) y no estamos
  // en TV, se resuelve con un formulario dentro de la misma app en vez de
  // mandar al usuario a un link/QR externo (que ni siquiera hace falta que
  // el brand tenga configurado para que esto aparezca).
  const canUseNativeForgotPassword = !isTV && isDeviceSessionEnabled(currentBrand);
  const canShowForgotPassword =
    canUseNativeForgotPassword || (forgotPasswordConfig?.enabled === true && forgotPasswordUrl.length > 0);
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

  const handleCloseForgotQrModal = useCallback(() => {
    setIsForgotQrModalOpen(false);
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

  useLoginTvNavigation({ isTV, loginFormRef });

  // Modal QR: zona de FocusManager — atrapa LEFT/RIGHT/UP/DOWN dentro del modal
  // (motor de geometría genérico) y BACK lo cierra; al cerrar, restaura el foco
  // al elemento que lo abrió (típicamente "Suscríbete aquí").
  useEffect(() => {
    if (!isQrModalOpen) return undefined;
    const zoneId = qrZoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: qrModalRootRef.current,
      onBack: () => {
        handleCloseQrModal();
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [isQrModalOpen, handleCloseQrModal]);

  useEffect(() => {
    if (!isUdidModalOpen) return undefined;
    const zoneId = udidZoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: udidModalRootRef.current,
      onBack: () => {
        handleCloseUdidModal();
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [isUdidModalOpen, handleCloseUdidModal]);

  useEffect(() => {
    if (!isForgotQrModalOpen) return undefined;
    const zoneId = forgotQrZoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: forgotQrModalRootRef.current,
      onBack: () => {
        handleCloseForgotQrModal();
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [isForgotQrModalOpen, handleCloseForgotQrModal]);

  // Foco inicial al abrir los modales QR/UDID (TV): sin esto, el foco se queda
  // en el botón que abrió el modal y el usuario no puede alcanzar "Cerrar" con
  // el control remoto hasta la primera flecha arriba/abajo.
  useEffect(() => {
    if (!isTV || !isQrModalOpen) return undefined;
    const timer = setTimeout(() => {
      document.getElementById(LOGIN_FOCUS_IDS.MODAL_CLOSE_QR)?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isTV, isQrModalOpen]);

  useEffect(() => {
    if (!isTV || !isUdidModalOpen) return undefined;
    const timer = setTimeout(() => {
      document.getElementById(LOGIN_FOCUS_IDS.MODAL_CLOSE_UDID)?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isTV, isUdidModalOpen]);

  useEffect(() => {
    if (!isTV || !isForgotQrModalOpen) return undefined;
    const timer = setTimeout(() => {
      document.getElementById(LOGIN_FOCUS_IDS.MODAL_CLOSE_FORGOT_QR)?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isTV, isForgotQrModalOpen]);

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
    if (!isForgotQrModalOpen) return;
    if (!canShowForgotPassword) {
      setForgotQrError(t('login.registerUnavailable'));
      setForgotQrImageSrc('');
      return;
    }

    let cancelled = false;
    const buildQr = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(forgotPasswordUrlWithOrigin, {
          width: 256,
          margin: 1,
        });
        if (cancelled) return;
        setForgotQrImageSrc(dataUrl);
        setForgotQrError('');
      } catch {
        if (cancelled) return;
        setForgotQrImageSrc('');
        setForgotQrError(t('login.registerUnavailable'));
      }
    };

    buildQr();
    return () => {
      cancelled = true;
    };
  }, [isForgotQrModalOpen, canShowForgotPassword, forgotPasswordUrlWithOrigin, t]);

  useEffect(() => {
    if (!isUdidModalOpen || !udidFlow.code) {
      setUdidQrImageSrc('');
      return;
    }
    let cancelled = false;
    const buildUdidQr = async () => {
      try {
        // Formato del QR (hallazgo #34, ver Back-Wind-V2/docs/
        // PROPUESTA_FORMATO_QR_UDID_2026-09-02.md): antes era un string
        // plano "{appName}:{code}:{temp_token}" que solo la propia app
        // sabía parsear -- escanearlo con cualquier otra cámara no hacía
        // nada. Ahora es una URL real (/wind/l/v1/<udid>/) que el backend
        // resuelve: cualquier cámara la abre en un navegador y termina en
        // "Vincular dispositivo" (auto-servicio), y una futura app nativa
        // con Universal/App Links configurados la interceptaría antes,
        // leyendo `t` (temp_token) para su propio flujo de login social
        // (sección 2.2 de esa guía) -- ninguno de los dos casos cambia acá.
        // `temp_token` sigue siendo el secreto real; la URL solo lo
        // transporta, igual que antes lo transportaba el string plano.
        const base = String(effectiveUdidConfig?.baseUrl || '').replace(/\/$/, '');
        const payload = base
          ? `${base}/wind/l/v1/${encodeURIComponent(udidFlow.code)}/${
              udidFlow.tempToken ? `?t=${encodeURIComponent(udidFlow.tempToken)}` : ''
            }`
          // Sin baseUrl configurado (no debería pasar si `enabled: true`,
          // pero por si acaso) cae al formato viejo en vez de generar un
          // QR con una URL relativa sin sentido.
          : udidFlow.tempToken
            ? `${appName}:${udidFlow.code}:${udidFlow.tempToken}`
            : `${appName}:${udidFlow.code}`;
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
  }, [appName, isUdidModalOpen, udidFlow.code, udidFlow.tempToken, effectiveUdidConfig?.baseUrl]);

  const handleOpenForgotPassword = () => {
    if (!canShowForgotPassword) return;
    if (canUseNativeForgotPassword) {
      setForgotEmail('');
      setForgotNativeError('');
      setForgotNativeSuccess(false);
      setIsForgotNativeModalOpen(true);
      return;
    }
    // En TV, redirigir (perder la app en la misma "pestaña") es mala UX y muchos
    // runtimes no navegan bien a una URL externa: mostramos un QR para que el
    // usuario continúe desde su teléfono. En PC (sin backend nativo) se mantiene
    // el link directo.
    if (isTV) {
      setForgotQrError('');
      setForgotQrImageSrc('');
      setIsForgotQrModalOpen(true);
      return;
    }
    window.location.assign(forgotPasswordUrlWithOrigin);
  };

  const handleCloseForgotNativeModal = useCallback(() => {
    setIsForgotNativeModalOpen(false);
  }, []);

  const handleForgotNativeSubmit = async (e) => {
    e.preventDefault();
    if (forgotSubmitting || !currentBrand) return;
    setForgotSubmitting(true);
    setForgotNativeError('');
    try {
      await requestPasswordReset(currentBrand, forgotEmail);
      setForgotNativeSuccess(true);
    } catch (err) {
      setForgotNativeError(
        err?.message || t('login.forgotPasswordNativeError', { defaultValue: 'No se pudo procesar la solicitud. Intenta de nuevo.' }),
      );
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleOpenQrModal = () => {
    if (!canShowQrRegister) return;
    if (!shouldShowQrModal) {
      // PC: abrir en una pestaña/ventana nueva para no perder la sesión de login actual.
      window.open(qrRegisterUrl, '_blank', 'noopener,noreferrer');
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
            // El JWT ya vino en esta misma respuesta del backend Wind
            // (login social) -- se pasa para que loginAndActivateLicense
            // no repita un login manual innecesario (Fase 3, ver loginFlow.js).
            deviceSessionAuth: { access: data.access, refresh: data.refresh, user: data.user },
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
            // Ver comentario equivalente en handleGoogleCredentialSuccess.
            deviceSessionAuth: { access: data.access, refresh: data.refresh, user: data.user },
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
            <div className={`login-forgot-row${isTV ? ' login-forgot-row--tv' : ''}`}>
              <FocusableButton
                type="button"
                className={`login-forgot-password${isTV ? ' login-tv-action-button' : ' login-text-link'}`}
                onClick={handleOpenForgotPassword}
                id={LOGIN_FOCUS_IDS.FORGOT_PASSWORD}
                tabIndex={0}
                data-tv-nav="login-actions"
              >
                {t('login.forgotPassword')}
              </FocusableButton>
            </div>
          )}

          {error && (
            <MessageModal
              type="error"
              message={error}
              onClose={() => setError('')}
            />
          )}

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
            isTV ? (
              <div className="login-subscribe-row">
                <span className="login-subscribe-hint">{t('login.noAccountYet')}</span>
                <FocusableButton
                  type="button"
                  className="login-tv-action-button login-subscribe-link"
                  onClick={handleOpenQrModal}
                  id={LOGIN_FOCUS_IDS.SUBSCRIBE}
                  tabIndex={0}
                  data-tv-nav="login-actions"
                >
                  {t('login.subscribeHere')}
                </FocusableButton>
              </div>
            ) : (
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
            )
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
                    <img
                      src={LOGIN_SOCIAL_LOGOS.google}
                      alt=""
                      className="social-button__icon"
                      aria-hidden="true"
                    />
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
                  <img
                    src={LOGIN_SOCIAL_LOGOS.google}
                    alt=""
                    className="social-button__icon"
                    aria-hidden="true"
                  />
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
                  <img
                    src={LOGIN_SOCIAL_LOGOS.facebook}
                    alt=""
                    className="social-button__icon"
                    aria-hidden="true"
                  />
                  {t('login.continueWithFacebook')}
                </FocusableButton>
              )}
              </div>
            </>
          )}
        </form>
      </div>

      {isQrModalOpen && (
        <div className="register-modal-backdrop" ref={qrModalRootRef}>
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

      {isForgotQrModalOpen && (
        <div className="register-modal-backdrop" ref={forgotQrModalRootRef}>
          <div className="register-modal">
            <h3>{t('login.forgotPasswordTitle')}</h3>
            <p>{t('login.forgotPasswordHint')}</p>

            {forgotQrImageSrc ? (
              <img src={forgotQrImageSrc} alt={t('login.forgotPassword')} className="register-qr-image" />
            ) : (
              <div className="register-qr-placeholder">{forgotQrError || t('common.loading')}</div>
            )}

            <FocusableButton
              type="button"
              className="register-close-button"
              onClick={handleCloseForgotQrModal}
              id={LOGIN_FOCUS_IDS.MODAL_CLOSE_FORGOT_QR}
              tabIndex={0}
            >
              {t('common.close')}
            </FocusableButton>
          </div>
        </div>
      )}

      {isForgotNativeModalOpen && (
        <div className="register-modal-backdrop">
          <div className="register-modal register-modal--forgot">
            {forgotNativeSuccess ? (
              <>
                <div className="register-modal-icon register-modal-icon--success" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l4.5 4.5L20 6" />
                  </svg>
                </div>
                <h3>{t('login.forgotPasswordTitle')}</h3>
                <p>
                  {t('login.forgotPasswordNativeSuccess', {
                    defaultValue:
                      'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.',
                  })}
                </p>
                <FocusableButton
                  type="button"
                  className="register-close-button"
                  onClick={handleCloseForgotNativeModal}
                >
                  {t('login.forgotPasswordBackToLogin', { defaultValue: 'Volver a iniciar sesión' })}
                </FocusableButton>
              </>
            ) : (
              <>
                <div className="register-modal-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 1 1 8 0v4" />
                  </svg>
                </div>
                <h3>{t('login.forgotPasswordTitle')}</h3>
                <form onSubmit={handleForgotNativeSubmit} className="login-form">
                  <p>
                    {t('login.forgotPasswordNativeHint', {
                      defaultValue: 'Ingresa el correo de tu cuenta y te enviaremos instrucciones para recuperar tu contraseña.',
                    })}
                  </p>
                  <div className="form-group form-group--plain form-group--icon">
                    <svg className="form-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z" />
                      <path d="M4 6.5l8 6 8-6" />
                    </svg>
                    <FocusableInput
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder={t('login.forgotPasswordEmailPlaceholder', { defaultValue: 'Correo electrónico' })}
                      disabled={forgotSubmitting}
                      autoComplete="email"
                      required
                      aria-label={t('login.forgotPasswordEmailPlaceholder', { defaultValue: 'Correo electrónico' })}
                    />
                  </div>

                  {forgotNativeError && (
                    <p className="form-error" role="alert">
                      {forgotNativeError}
                    </p>
                  )}

                  <FocusableButton type="submit" className="login-button" disabled={forgotSubmitting}>
                    {forgotSubmitting
                      ? t('login.forgotPasswordSubmitting', { defaultValue: 'Enviando...' })
                      : t('login.forgotPasswordSubmit', { defaultValue: 'Enviar' })}
                  </FocusableButton>

                  <FocusableButton
                    type="button"
                    className="register-text-link"
                    onClick={handleCloseForgotNativeModal}
                    disabled={forgotSubmitting}
                  >
                    {t('common.close')}
                  </FocusableButton>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {isUdidModalOpen && (
        <div className="register-modal-backdrop" ref={udidModalRootRef}>
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
