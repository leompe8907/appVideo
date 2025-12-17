import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveBrandConfig } from '../config/brandConfig';
import { applyTheme } from '../utils/config';
import panaccessService from '../services/panaccessService';
import getUdid from '../api/cv/udid';
import CryptoJS from 'crypto-js';
import { classifyError, ERROR_TYPES } from '../api/cv/errorClassifier';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

export function LoginPage() {
  const navigate = useNavigate();
  const [brandConfig, setBrandConfig] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const config = getActiveBrandConfig();
    setBrandConfig(config);
    console.log(SECRET_KEY)
    
    if (config) {
      applyTheme(config);
      document.title = `${config.appName} - Login`;
      
      // Inicializar servicio con la config de la marca
      panaccessService.initialize(config);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isLoading) return;
    
    setIsLoading(true);
    setError('');

    try {
      // Login - La contraseña NO se encripta aquí, CV.js lo hace internamente con MD5
      let udid = localStorage.getItem("udid");
      if (!udid) {
        udid = getUdid();
        console.log("UDID generado:", udid);
      }

      const sessionId = await panaccessService.login("clientLogin", {
        apiToken: SECRET_KEY,
        clientId: username,
        pwd: password,
        udid: udid,
      });

      // Encriptar credenciales para guardar (para auto-login futuro)
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
        setIsLoading(false);
        navigate('/home');
      }, 1000);

    } catch (err) {
      setTimeout(() => {
        setIsLoading(false);
        
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

  if (!brandConfig) {
    return <div className="loading">Cargando configuración...</div>;
  }

  return (
    <div className="panaccess-login">
      <div className="login-card">
        <h2>Iniciar Sesión</h2>
        <p className="brand-name">{brandConfig.appName}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
              disabled={isLoading}
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
                disabled={isLoading}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
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
            disabled={isLoading}
            className="login-button"
          >
            {isLoading ? 'Conectando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-info">
          <p><strong>DRM:</strong> {brandConfig.drm}</p>
          <p><strong>Token:</strong> {brandConfig.token?.substring(0, 8)}...</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

