/**
 * Página de Login
 * - TV: Navegación con Norigin (D-pad)
 * - PC: Navegación nativa (Tab, Click)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import panaccessService from '../services/panaccessService';
import getUdid from '../api/cv/udid';
import CryptoJS from 'crypto-js';
import { classifyError, ERROR_TYPES } from '../api/cv/errorClassifier';
import '../styles/components/_login.scss';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

// Focus keys para TV
const USERNAME_FOCUS_KEY = 'login-username';
const PASSWORD_FOCUS_KEY = 'login-password';
const TOGGLE_FOCUS_KEY = 'login-toggle';
const SUBMIT_FOCUS_KEY = 'login-submit';

export function LoginPage() {
  const navigate = useNavigate();
  const { currentBrand, token, appName, isLoading, getImage } = useBrand();
  const { isTV } = useDevice();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  console.log(`🖥️ [DEVICE] Modo: ${isTV ? 'TV' : 'PC'}`);

  // ============================================
  // NORIGIN HOOKS - Solo se usan visualmente en TV
  // ============================================
  
  const { ref: containerRef, focusKey } = useFocusable({
    focusable: false,
    isFocusBoundary: true,
  });

  const { ref: usernameRef, focused: usernameFocused } = useFocusable({
    focusKey: USERNAME_FOCUS_KEY,
    onEnterPress: () => {
      if (isTV) {
        console.log('⏎ [TV] Username - abriendo teclado');
        usernameRef.current?.focus();
      }
    },
    onArrowPress: (direction) => {
      if (!isTV) return true;
      if (direction === 'down') {
        setFocus(PASSWORD_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  const { ref: passwordRef, focused: passwordFocused } = useFocusable({
    focusKey: PASSWORD_FOCUS_KEY,
    onEnterPress: () => {
      if (isTV) {
        console.log('⏎ [TV] Password - abriendo teclado');
        passwordRef.current?.focus();
      }
    },
    onArrowPress: (direction) => {
      if (!isTV) return true;
      if (direction === 'down') {
        setFocus(SUBMIT_FOCUS_KEY);
        return false;
      }
      if (direction === 'up') {
        setFocus(USERNAME_FOCUS_KEY);
        return false;
      }
      if (direction === 'right') {
        setFocus(TOGGLE_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  const { ref: toggleRef, focused: toggleFocused } = useFocusable({
    focusKey: TOGGLE_FOCUS_KEY,
    onEnterPress: () => {
      if (isTV) {
        console.log('⏎ [TV] Toggle - cambiando visibilidad');
        setShowPassword(!showPassword);
      }
    },
    onArrowPress: (direction) => {
      if (!isTV) return true;
      if (direction === 'down') {
        setFocus(SUBMIT_FOCUS_KEY);
        return false;
      }
      if (direction === 'up') {
        setFocus(USERNAME_FOCUS_KEY);
        return false;
      }
      if (direction === 'left') {
        setFocus(PASSWORD_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  const { ref: submitRef, focused: submitFocused } = useFocusable({
    focusKey: SUBMIT_FOCUS_KEY,
    onEnterPress: () => {
      if (isTV && !isSubmitting) {
        console.log('⏎ [TV] Submit - enviando formulario');
        handleSubmit();
      }
    },
    onArrowPress: (direction) => {
      if (!isTV) return true;
      if (direction === 'up') {
        setFocus(PASSWORD_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  // ============================================
  // EFECTOS - Solo para TV
  // ============================================

  // Focus inicial - SOLO EN TV
  useEffect(() => {
    if (!isTV) return;
    
    const timer = setTimeout(() => {
      setFocus(USERNAME_FOCUS_KEY);
      console.log('🎯 [TV] Focus inicial en username');
    }, 300);
    return () => clearTimeout(timer);
  }, [isTV]);

  // Handler global Enter - SOLO EN TV
  useEffect(() => {
    if (!isTV) return;

    const handleKeyDown = (e) => {
      const key = e.key || e.keyCode;
      const isEnter = key === 'Enter' || key === 13 || key === 65385;
      
      if (!isEnter) return;

      if (usernameFocused) {
        e.preventDefault();
        usernameRef.current?.focus();
      } else if (passwordFocused) {
        e.preventDefault();
        passwordRef.current?.focus();
      } else if (toggleFocused) {
        e.preventDefault();
        setShowPassword(prev => !prev);
      } else if (submitFocused && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTV, usernameFocused, passwordFocused, toggleFocused, submitFocused, isSubmitting]);

  // ============================================
  // HANDLERS DE INPUTS
  // ============================================

  // Blur handlers - SOLO EN TV (re-enfocar Norigin cuando se cierra el teclado)
  const handleUsernameBlur = () => {
    if (isTV) {
      console.log('🚫 [TV] Username blur - re-enfocando Norigin');
      setTimeout(() => setFocus(USERNAME_FOCUS_KEY), 100);
    }
  };

  const handlePasswordBlur = () => {
    if (isTV) {
      console.log('🚫 [TV] Password blur - re-enfocando Norigin');
      setTimeout(() => setFocus(PASSWORD_FOCUS_KEY), 100);
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
      let udid = localStorage.getItem("udid");
      if (!udid) {
        udid = getUdid();
      }

      const sessionId = await panaccessService.login("clientLogin", {
        apiToken: token,
        clientId: username,
        pwd: password,
        udid: udid,
      });

      const encryptedUsername = CryptoJS.AES.encrypt(username, SECRET_KEY).toString();
      const encryptedPassword = CryptoJS.AES.encrypt(password, SECRET_KEY).toString();

      localStorage.setItem('username', encryptedUsername);
      localStorage.setItem('password', encryptedPassword);
      localStorage.setItem('sessionId', sessionId);
      localStorage.setItem('udid', udid);

      setTimeout(() => {
        setIsSubmitting(false);
        navigate('/home');
      }, 1000);

    } catch (err) {
      setTimeout(() => {
        setIsSubmitting(false);
        const errorInfo = err.errorInfo || classifyError(err);
        let messageToShow = 'Error al iniciar sesión';

        switch (errorInfo.type) {
          case ERROR_TYPES.NETWORK:
            messageToShow = 'Sin conexión a internet.';
            break;
          case ERROR_TYPES.TIMEOUT:
            messageToShow = 'Conexión lenta. Intenta de nuevo.';
            break;
          case ERROR_TYPES.SERVER:
            messageToShow = 'Error del servidor.';
            break;
          case ERROR_TYPES.AUTH:
            messageToShow = 'Credenciales inválidas.';
            break;
          default:
            messageToShow = errorInfo.userMessage || err.message || 'Error al iniciar sesión';
        }
        setError(messageToShow);
      }, 1000);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (isLoading || !currentBrand) {
    return <div className="loading">Cargando...</div>;
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

      <FocusContext.Provider value={focusKey}>
        <div ref={containerRef} className="login-card">
          <h2>Iniciar Sesión</h2>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                ref={usernameRef}
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu usuario"
                disabled={isSubmitting}
                autoComplete="username"
                className={isTV && usernameFocused ? 'focused' : ''}
                onBlur={handleUsernameBlur}
                required
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="password-row">
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  className={isTV && passwordFocused ? 'focused' : ''}
                  onBlur={handlePasswordBlur}
                  required
                />
                <button
                  ref={toggleRef}
                  type="button"
                  className={`password-toggle ${isTV && toggleFocused ? 'focused' : ''}`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              ref={submitRef}
              type="submit" 
              disabled={isSubmitting}
              className={`login-button ${isTV && submitFocused ? 'focused' : ''}`}
            >
              {isSubmitting ? 'Conectando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </FocusContext.Provider>
    </div>
  );
}

export default LoginPage;
