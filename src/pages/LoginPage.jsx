/**
 * Página de Login con navegación espacial para TV
 * Versión simplificada
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useBrand } from '../contexts/BrandContext';
import panaccessService from '../services/panaccessService';
import getUdid from '../api/cv/udid';
import CryptoJS from 'crypto-js';
import { classifyError, ERROR_TYPES } from '../api/cv/errorClassifier';
import '../styles/components/_login.scss';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

// Focus keys
const USERNAME_FOCUS_KEY = 'login-username';
const PASSWORD_FOCUS_KEY = 'login-password';
const TOGGLE_FOCUS_KEY = 'login-toggle';
const SUBMIT_FOCUS_KEY = 'login-submit';

export function LoginPage() {
  const navigate = useNavigate();
  const { currentBrand, token, appName, isLoading, getImage } = useBrand();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Container
  const { ref: containerRef, focusKey } = useFocusable({
    focusable: false,
    isFocusBoundary: true,
  });

  // Username input
  const { ref: usernameRef, focused: usernameFocused } = useFocusable({
    focusKey: USERNAME_FOCUS_KEY,
    onFocus: () => console.log('🎯 [FOCUS] Username input recibió FOCUS'),
    onBlur: () => console.log('💨 [BLUR] Username input perdió FOCUS'),
    onEnterPress: () => {
      console.log('⏎ [ENTER] Username - abriendo teclado');
      usernameRef.current?.focus();
    },
    onArrowPress: (direction) => {
      console.log(`⬆⬇⬅➡ [ARROW] Username - dirección: ${direction}`);
      if (direction === 'down') {
        console.log('  → Navegando a Password');
        setFocus(PASSWORD_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  // Password input
  const { ref: passwordRef, focused: passwordFocused } = useFocusable({
    focusKey: PASSWORD_FOCUS_KEY,
    onFocus: () => console.log('🎯 [FOCUS] Password input recibió FOCUS'),
    onBlur: () => console.log('💨 [BLUR] Password input perdió FOCUS'),
    onEnterPress: () => {
      console.log('⏎ [ENTER] Password - abriendo teclado');
      passwordRef.current?.focus();
    },
    onArrowPress: (direction) => {
      console.log(`⬆⬇⬅➡ [ARROW] Password - dirección: ${direction}`);
      if (direction === 'down') {
        console.log('  → Navegando a Submit');
        setFocus(SUBMIT_FOCUS_KEY);
        return false;
      }
      if (direction === 'up') {
        console.log('  → Navegando a Username');
        setFocus(USERNAME_FOCUS_KEY);
        return false;
      }
      if (direction === 'right') {
        console.log('  → Navegando a Toggle');
        setFocus(TOGGLE_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  // Toggle button
  const { ref: toggleRef, focused: toggleFocused } = useFocusable({
    focusKey: TOGGLE_FOCUS_KEY,
    onFocus: () => console.log('🎯 [FOCUS] Toggle button recibió FOCUS'),
    onBlur: () => console.log('💨 [BLUR] Toggle button perdió FOCUS'),
    onEnterPress: () => {
      console.log('⏎ [ENTER] Toggle - cambiando visibilidad password');
      setShowPassword(!showPassword);
    },
    onArrowPress: (direction) => {
      console.log(`⬆⬇⬅➡ [ARROW] Toggle - dirección: ${direction}`);
      if (direction === 'down') {
        console.log('  → Navegando a Submit');
        setFocus(SUBMIT_FOCUS_KEY);
        return false;
      }
      if (direction === 'up') {
        console.log('  → Navegando a Username');
        setFocus(USERNAME_FOCUS_KEY);
        return false;
      }
      if (direction === 'left') {
        console.log('  → Navegando a Password');
        setFocus(PASSWORD_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  // Submit button
  const { ref: submitRef, focused: submitFocused } = useFocusable({
    focusKey: SUBMIT_FOCUS_KEY,
    onFocus: () => console.log('🎯 [FOCUS] Submit button recibió FOCUS'),
    onBlur: () => console.log('💨 [BLUR] Submit button perdió FOCUS'),
    onEnterPress: () => {
      console.log('⏎ [ENTER] Submit - enviando formulario');
      if (!isSubmitting) {
        handleSubmit();
      }
    },
    onArrowPress: (direction) => {
      console.log(`⬆⬇⬅➡ [ARROW] Submit - dirección: ${direction}`);
      if (direction === 'up') {
        console.log('  → Navegando a Password');
        setFocus(PASSWORD_FOCUS_KEY);
        return false;
      }
      return true;
    },
  });

  // Focus inicial
  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus(USERNAME_FOCUS_KEY);
      console.log('[Login] Focus inicial en username');
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Log del estado de focus actual
  useEffect(() => {
    const focusedElement = usernameFocused ? 'USERNAME' : 
                          passwordFocused ? 'PASSWORD' : 
                          toggleFocused ? 'TOGGLE' : 
                          submitFocused ? 'SUBMIT' : 'NINGUNO';
    console.log(`📍 [ESTADO] Elemento con focus Norigin: ${focusedElement}`);
  }, [usernameFocused, passwordFocused, toggleFocused, submitFocused]);

  // Handler global para Enter (backup)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key || e.keyCode;
      const isEnter = key === 'Enter' || key === 13 || key === 65385;
      
      if (!isEnter) return;

      console.log('⏎ [KEYDOWN] Enter detectado via handler global');
      console.log('  Estados focused:', { 
        username: usernameFocused, 
        password: passwordFocused, 
        toggle: toggleFocused, 
        submit: submitFocused 
      });

      if (usernameFocused) {
        console.log('  → Ejecutando: abrir teclado username');
        e.preventDefault();
        usernameRef.current?.focus();
      } else if (passwordFocused) {
        console.log('  → Ejecutando: abrir teclado password');
        e.preventDefault();
        passwordRef.current?.focus();
      } else if (toggleFocused) {
        console.log('  → Ejecutando: toggle password visibility');
        e.preventDefault();
        setShowPassword(prev => !prev);
      } else if (submitFocused && !isSubmitting) {
        console.log('  → Ejecutando: submit formulario');
        e.preventDefault();
        handleSubmit();
      } else {
        console.log('  → Ningún elemento focused, no se ejecuta acción');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [usernameFocused, passwordFocused, toggleFocused, submitFocused, isSubmitting, showPassword]);

  // Focus handlers (teclado se abre)
  const handleUsernameFocus = () => {
    console.log('⌨️ [TECLADO ABIERTO] Username input - teclado virtual ABIERTO');
    console.log('  → document.activeElement:', document.activeElement?.id || document.activeElement?.tagName);
  };

  const handlePasswordFocus = () => {
    console.log('⌨️ [TECLADO ABIERTO] Password input - teclado virtual ABIERTO');
    console.log('  → document.activeElement:', document.activeElement?.id || document.activeElement?.tagName);
  };

  // Blur handlers (teclado se cierra)
  const handleUsernameBlur = () => {
    console.log('🚫 [TECLADO CERRADO] Username input - teclado virtual CERRADO');
    console.log('  → document.activeElement:', document.activeElement?.id || document.activeElement?.tagName);
    console.log('  → Re-enfocando Norigin en Username');
    setTimeout(() => setFocus(USERNAME_FOCUS_KEY), 100);
  };

  const handlePasswordBlur = () => {
    console.log('🚫 [TECLADO CERRADO] Password input - teclado virtual CERRADO');
    console.log('  → document.activeElement:', document.activeElement?.id || document.activeElement?.tagName);
    console.log('  → Re-enfocando Norigin en Password');
    setTimeout(() => setFocus(PASSWORD_FOCUS_KEY), 100);
  };

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
                className={usernameFocused ? 'focused' : ''}
                onFocus={handleUsernameFocus}
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
                  className={passwordFocused ? 'focused' : ''}
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  required
                />
                <button
                  ref={toggleRef}
                  type="button"
                  className={`password-toggle ${toggleFocused ? 'focused' : ''}`}
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
              className={`login-button ${submitFocused ? 'focused' : ''}`}
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
