import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveBrandConfig } from '../config/brandConfig';
import { applyTheme } from '../utils/config';
import panaccessService from '../services/panaccessService';
import CryptoJS from 'crypto-js';
import getUdid from '../api/cv/udid';
import '../styles/components/_splash.scss';


const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

export function SplashPage() {
  const navigate = useNavigate();
  const [brandConfig, setBrandConfig] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initializeAndLogin = async () => {
      try {
        // 1. Cargar configuración de marca
        const config = getActiveBrandConfig();
        setBrandConfig(config);

        if (!config) {
          // Esperar tiempo mínimo y redirigir a login
          setTimeout(() => navigate('/login'), 3000);
          return;
        }
        
        // Obtener duración del splash desde la configuración (puede estar en ui o en raíz)
        const splashDuration = config.ui?.splashDuration || config.splashDuration || 3000;

        // Aplicar tema
        applyTheme(config);
        document.title = `${config.appName} - Cargando...`;

        // 2. Inicializar servicio
        await panaccessService.initialize(config);

        // 3. Verificar si hay sesión activa
        const savedSessionId = localStorage.getItem('cvSessionId') || localStorage.getItem('sessionId');
        if (savedSessionId) {
          try {
            const isValid = await panaccessService.validateSession();
            if (isValid) {
              setIsAuthenticated(true);
              // Esperar tiempo del splash y redirigir a home
              setTimeout(() => navigate('/home'), splashDuration);
              return;
            }
          } catch (error) {
            console.warn('[Splash] Sesión inválida:', error);
            // Continuar con auto-login
          }
        }

        // 4. Intentar auto-login con credenciales guardadas
        const encryptedUsername = localStorage.getItem('username');
        const encryptedPassword = localStorage.getItem('password');

        if (!encryptedUsername || !encryptedPassword) {
          // No hay credenciales, esperar tiempo del splash y redirigir a login
          setTimeout(() => navigate('/login'), splashDuration);
          return;
        }

        // 5. Desencriptar credenciales
        let username, password;
        try {
          username = CryptoJS.AES.decrypt(encryptedUsername, SECRET_KEY).toString(CryptoJS.enc.Utf8);
          password = CryptoJS.AES.decrypt(encryptedPassword, SECRET_KEY).toString(CryptoJS.enc.Utf8);
        } catch (error) {
          console.error('[Splash] Error desencriptando:', error);
          // Esperar tiempo del splash y redirigir a login
          setTimeout(() => navigate('/login'), splashDuration);
          return;
        }

        if (!username || !password) {
          // Credenciales inválidas, esperar tiempo del splash y redirigir a login
          setTimeout(() => navigate('/login'), splashDuration);
          return;
        }

        // 6. Hacer login automático
        let udid = localStorage.getItem('udid');
        if (!udid) {
          udid = getUdid();
          localStorage.setItem('udid', udid);
        }

        const sessionId = await panaccessService.login('clientLogin', {
          apiToken: config.token,
          clientId: username,
          pwd: password,
          udid: udid,
        });

        if (sessionId) {
          localStorage.setItem('sessionId', sessionId);
          localStorage.setItem('udid', udid);
          setIsAuthenticated(true);
          // Esperar tiempo del splash y redirigir a home
          setTimeout(() => navigate('/home'), splashDuration);
        } else {
          throw new Error('No se recibió sessionId');
        }

      } catch (error) {
        console.error('[Splash] Error en auto-login:', error);
        
        // Limpiar credenciales inválidas
        localStorage.removeItem('cvSessionId');
        localStorage.removeItem('sessionId');
        
        // Obtener duración del splash (puede estar en ui o en raíz)
        const splashDuration = brandConfig?.ui?.splashDuration || brandConfig?.splashDuration || 3000;
        
        // Esperar tiempo del splash y redirigir a login
        setTimeout(() => navigate('/login'), splashDuration);
      }
    };

    initializeAndLogin();
  }, [navigate]);

  if (!brandConfig) {
    return (
      <div className="splash-page">
        <div className="splash-content">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="splash-page">
      <div className="splash-content">
        {brandConfig.assets?.splash && (
          <img 
            src={brandConfig.assets.splash} 
            alt={`${brandConfig.appName} Splash`}
            className="splash-image"
          />
        )}
      </div>
    </div>
  );
}

export default SplashPage;
