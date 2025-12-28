import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { getInitialRoute } from '../utils/navigation';
import panaccessService from '../services/panaccessService';
import CryptoJS from 'crypto-js';
import getUdid from '../api/cv/udid';
import '../styles/components/_splash.scss';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

export function SplashPage() {
  const navigate = useNavigate();
  const { currentBrand, splashDuration, isLoading, getImage, appName } = useBrand();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Esperar a que el brand se cargue
    if (isLoading) return;
    
    if (!currentBrand) {
      // Esperar tiempo mínimo y redirigir a login
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    const initializeAndLogin = async () => {
      try {
        // El BrandContext ya inicializó panaccessService, pero verificamos
        // Si no está inicializado, lo inicializamos
        if (!panaccessService.client) {
          await panaccessService.initialize(currentBrand);
        }

        // 3. Verificar si hay sesión activa
        const savedSessionId = localStorage.getItem('cvSessionId') || localStorage.getItem('sessionId');
        if (savedSessionId) {
          try {
            const isValid = await panaccessService.validateSession();
            if (isValid) {
              setIsAuthenticated(true);
              // Esperar tiempo del splash y redirigir según configuración del brand
              const initialRoute = getInitialRoute(currentBrand);
              setTimeout(() => navigate(initialRoute), splashDuration);
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
        let decryptionSuccess = false;
        
        // Intentar desencriptar con SECRET_KEY (clave actual)
        try {
          const decryptedUsername = CryptoJS.AES.decrypt(encryptedUsername, SECRET_KEY);
          const decryptedPassword = CryptoJS.AES.decrypt(encryptedPassword, SECRET_KEY);
          
          username = decryptedUsername.toString(CryptoJS.enc.Utf8);
          password = decryptedPassword.toString(CryptoJS.enc.Utf8);
          
          // Verificar que la desencriptación fue exitosa
          if (username && password && username.length > 0 && password.length > 0) {
            decryptionSuccess = true;
          }
        } catch (error) {
          console.warn('[Splash] Error desencriptando con SECRET_KEY:', error.message);
        }
        
        // Si falló, intentar con token del brand (para credenciales viejas)
        if (!decryptionSuccess && currentBrand?.token) {
          try {
            const decryptedUsername = CryptoJS.AES.decrypt(encryptedUsername, currentBrand.token);
            const decryptedPassword = CryptoJS.AES.decrypt(encryptedPassword, currentBrand.token);
            
            username = decryptedUsername.toString(CryptoJS.enc.Utf8);
            password = decryptedPassword.toString(CryptoJS.enc.Utf8);
            
            if (username && password && username.length > 0 && password.length > 0) {
              decryptionSuccess = true;
              console.info('[Splash] Credenciales desencriptadas con token del brand (migración automática)');
              // Re-encriptar con SECRET_KEY para futuras sesiones
              const newEncryptedUsername = CryptoJS.AES.encrypt(username, SECRET_KEY).toString();
              const newEncryptedPassword = CryptoJS.AES.encrypt(password, SECRET_KEY).toString();
              localStorage.setItem('username', newEncryptedUsername);
              localStorage.setItem('password', newEncryptedPassword);
            }
          } catch (error) {
            console.warn('[Splash] Error desencriptando con token del brand:', error.message);
          }
        }
        
        // Si ambas fallaron, limpiar y redirigir
        if (!decryptionSuccess) {
          console.error('[Splash] No se pudieron desencriptar las credenciales. Limpiando...');
          
          // Limpiar credenciales inválidas
          localStorage.removeItem('username');
          localStorage.removeItem('password');
          localStorage.removeItem('cvSessionId');
          localStorage.removeItem('sessionId');
          
          // Esperar tiempo del splash y redirigir a login
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
          apiToken: currentBrand.token,
          clientId: username,
          pwd: password,
          udid: udid,
        });

        if (sessionId) {
          localStorage.setItem('sessionId', sessionId);
          localStorage.setItem('udid', udid);
          setIsAuthenticated(true);
          // Esperar tiempo del splash y redirigir según configuración del brand
          const initialRoute = getInitialRoute(currentBrand);
          setTimeout(() => navigate(initialRoute), splashDuration);
        } else {
          throw new Error('No se recibió sessionId');
        }

      } catch (error) {
        console.error('[Splash] Error en auto-login:', error);
        
        // Limpiar credenciales inválidas
        localStorage.removeItem('cvSessionId');
        localStorage.removeItem('sessionId');
        
        // Esperar tiempo del splash y redirigir a login
        setTimeout(() => navigate('/login'), splashDuration);
      }
    };

    initializeAndLogin();
  }, [navigate, currentBrand, isLoading, splashDuration]);

  // Mostrar loading mientras carga el brand
  if (isLoading || !currentBrand) {
    return (
      <div className="splash-page">
        <div className="splash-content">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  // Obtener imagen de splash (puede ser .png, .gif, .webp, .jpg según configuración)
  const splashImage = currentBrand.assets?.splash || getImage('splash.png') || getImage('splash.gif');

  return (
    <div className="splash-page">
      <div className="splash-content">
        {splashImage && (
          <img 
            src={splashImage} 
            alt={`${appName} Splash`}
            className="splash-image"
          />
        )}
      </div>
    </div>
  );
}

export default SplashPage;
