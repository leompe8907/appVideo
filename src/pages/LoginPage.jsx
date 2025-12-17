import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import panaccessService from '../services/panaccessService';
import getUdid from '../api/cv/udid';
import CryptoJS from 'crypto-js';
import { classifyError, ERROR_TYPES } from '../api/cv/errorClassifier';
import '../styles/components/_login.scss';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

export function LoginPage() {
  const navigate = useNavigate();
  const { currentBrand, token, appName, isLoading, getImage } = useBrand();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting || !currentBrand) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      // Login - La contraseña NO se encripta aquí, CV.js lo hace internamente con MD5
      let udid = localStorage.getItem("udid");
      if (!udid) {
        udid = getUdid();
        console.log("UDID generado:", udid);
      }

      const sessionId = await panaccessService.login("clientLogin", {
        apiToken: token,
        clientId: username,
        pwd: password,
        udid: udid,
      });

      // Encriptar credenciales para guardar (para auto-login futuro)
      // Usar SECRET_KEY para encriptación local, NO brandConfig.token
      const encryptedUsername = CryptoJS.AES.encrypt(username, SECRET_KEY).toString();
      const encryptedPassword = CryptoJS.AES.encrypt(password, SECRET_KEY).toString();

      // Guardar credenciales encriptadas
      localStorage.setItem('username', encryptedUsername);
      localStorage.setItem('password', encryptedPassword);
      localStorage.setItem('sessionId', sessionId);
      localStorage.setItem('udid', udid);

      console.log('[Login] Login exitoso');

      // Delay para mostrar loading
      setTimeout(() => {
        setIsSubmitting(false);
        navigate('/home');
      }, 1000);

    } catch (err) {
      setTimeout(() => {
        setIsSubmitting(false);
        
        // Clasificar error
        const errorInfo = err.errorInfo || classifyError(err);
        let messageToShow = 'Error al iniciar sesión';

        switch (errorInfo.type) {
          case ERROR_TYPES.NETWORK:
            messageToShow = 'Sin conexión a internet. Verifica tu red.';
            break;
          case ERROR_TYPES.TIMEOUT:
            messageToShow = 'La conexión tardó demasiado. Intenta de nuevo.';
            break;
          case ERROR_TYPES.SERVER:
            messageToShow = 'Error del servidor. Intenta más tarde.';
            break;
          case ERROR_TYPES.AUTH:
            messageToShow = 'Credenciales inválidas. Verifica tu usuario y contraseña.';
            break;
          default:
            messageToShow = errorInfo.userMessage || err.message || 'Error al iniciar sesión';
        }

        setError(messageToShow);
        console.error('[Login] Error:', err);
      }, 1000);
    }
  };

  if (isLoading || !currentBrand) {
    return <div className="loading">Cargando configuración...</div>;
  }

  const logoPath = getImage('logo.png');
  const backgroundPath = currentBrand.assets?.background || getImage('background.png');

  return (
    <div 
      className="panaccess-login"
      style={backgroundPath ? {
        backgroundImage: `url(${backgroundPath})`
      } : {}}
    >
      <div className="login-brand-section">
        {logoPath && (
          <img src={logoPath} alt={appName} className="brand-logo" />
        )}
      </div>

      <div className="login-card">
        <h2>Iniciar Sesión</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
              disabled={isSubmitting}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                disabled={isSubmitting}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }
                }}
                tabIndex={0}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="login-button"
          >
            {isSubmitting ? 'Conectando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;

