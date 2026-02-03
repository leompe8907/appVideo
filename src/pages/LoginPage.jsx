import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { FocusableInput } from '../components/navigation/FocusableInput';
import { FocusableButton } from '../components/navigation/FocusableButton';
import { getInitialRoute } from '../utils/navigation';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import panaccessService from '../services/panaccessService';
import getUdid from '../api/cv/udid';
import CryptoJS from 'crypto-js';
import { classifyError, ERROR_TYPES } from '../api/cv/errorClassifier';
import '../styles/components/_login.scss';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, token, appName, isLoading, getImage } = useBrand();
  const { isTV } = useDevice();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  console.log(`🖥️ [DEVICE] Modo: ${isTV ? 'TV' : 'PC'}`);

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

  // ============================================
  // SUBMIT
  // ============================================

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting || !currentBrand) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      let udid = localStorage.getItem("udid");
      if (!udid) {
        udid = getUdid();
      }

      // Asegurar que el servicio esté inicializado
      if (!panaccessService.client) {
        await panaccessService.initialize(currentBrand);
      }

      const sessionId = await panaccessService.callLoginApi("clientLogin", {
        apiToken: token,
        clientId: username.trim(),
        pwd: password.trim(),
        udid: udid,
      });

      if (!sessionId || (typeof sessionId === 'string' && sessionId.trim() === '')) {
        throw new Error(t('login.errorNoSession'));
      }

      const encryptedUsername = CryptoJS.AES.encrypt(username.trim(), SECRET_KEY).toString();
      const encryptedPassword = CryptoJS.AES.encrypt(password.trim(), SECRET_KEY).toString();

      localStorage.setItem('username', encryptedUsername);
      localStorage.setItem('password', encryptedPassword);
      localStorage.setItem('sessionId', sessionId);
      localStorage.setItem('udid', udid);

      setTimeout(() => {
        setIsSubmitting(false);
        const initialRoute = getInitialRoute(currentBrand);
        navigate(initialRoute);
      }, 1000);

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
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
