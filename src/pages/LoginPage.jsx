/**
 * Página de Login
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import panaccessService from '../services/panaccessService';
import getUdid from '../api/cv/udid';
import CryptoJS from 'crypto-js';
import { classifyError, ERROR_TYPES } from '../api/cv/errorClassifier';
import '../styles/components/_login.scss';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

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

      <div className="login-card">
        <h2>Iniciar Sesión</h2>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
              disabled={isSubmitting}
              autoComplete="username"
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-row">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

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
