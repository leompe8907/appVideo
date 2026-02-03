import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CryptoJS from 'crypto-js';
import panaccessService from '../services/panaccessService';
import { useBrand } from '../contexts/BrandContext';
import getUdid from '../cv/udid';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

export function useAuthValidator() {
  const navigate = useNavigate();
  const { token, currentBrand } = useBrand();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const sessionId = localStorage.getItem('sessionId');

        // Si no existe sessionId, redirigir a login
        if (!sessionId) {
          console.log('[AuthValidator] No existe sessionId. Redirigiendo a Login...');
          navigate('/');
          return;
        }

        // Validar sessionId con getClientConfig
        try {
          const clientConfig = await panaccessService.callAuthenticatedApi('getClientConfig', {}, { enableRetry: false });
          
          if (clientConfig) {
            console.log('[AuthValidator] SessionId válido');
            return;
          }
        } catch (error) {
          console.warn('[AuthValidator] Sesión inválida, intentando login automático...');
        }

        // Si la validación falla, intentar iniciar sesión automáticamente
        const encryptedUsername = localStorage.getItem('username');
        const encryptedPassword = localStorage.getItem('password');

        if (!encryptedUsername || !encryptedPassword) {
          console.log('[AuthValidator] No se encontraron credenciales almacenadas. Redirigiendo a Login...');
          navigate('/');
          return;
        }

        // Desencriptar credenciales
        const username = CryptoJS.AES.decrypt(encryptedUsername, SECRET_KEY).toString(CryptoJS.enc.Utf8);
        const password = CryptoJS.AES.decrypt(encryptedPassword, SECRET_KEY).toString(CryptoJS.enc.Utf8);

        if (!username || !password) {
          console.log('[AuthValidator] Credenciales corruptas. Redirigiendo a Login...');
          navigate('/');
          return;
        }

        // Obtener udid
        let udid = localStorage.getItem('udid');
        if (!udid) {
          udid = getUdid();
          localStorage.setItem('udid', udid);
        }

        // Verificar que tenemos el token del brand
        if (!token || !currentBrand) {
          console.error('[AuthValidator] No hay configuración de brand disponible');
          navigate('/');
          return;
        }

        console.log('[AuthValidator] Intentando iniciar sesión automáticamente...');
        const sessionIdNew = await panaccessService.callLoginApi('clientLogin', {
          apiToken: token,
          clientId: username,
          pwd: password,
          udid: udid,
        });

        // Validar que sessionId es válido
        if (!sessionIdNew || sessionIdNew.length === 0) {
          throw new Error('Credenciales inválidas.');
        }

        // Guardar el nuevo sessionId
        localStorage.setItem('sessionId', sessionIdNew);
        console.log('[AuthValidator] Inicio de sesión automático exitoso');

      } catch (error) {
        console.error('[AuthValidator] Error en la validación de sesión o inicio de sesión automático:', error);
        // Limpiar storage y redirigir a login
        localStorage.removeItem('sessionId');
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        navigate('/');
      }
    };

    // Solo ejecutar si tenemos el brand config cargado
    if (currentBrand && token) {
      validateSession();
    }
  }, [navigate, token, currentBrand]);

  return null;
}

export default useAuthValidator;
