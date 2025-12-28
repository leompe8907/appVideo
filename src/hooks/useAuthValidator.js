/**
 * Hook para validar sesión automáticamente
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CryptoJS from 'crypto-js';
import panaccessService from '../services/panaccessService';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

export function useAuthValidator() {
  const navigate = useNavigate();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const sessionId = localStorage.getItem('cvSessionId');

        // Si no existe sessionId, redirigir a login
        if (!sessionId) {
          console.log('[AuthValidator] No existe sessionId. Redirigiendo a Login...');
          navigate('/');
          return;
        }

        // Validar sessionId con el servicio
        const isValid = await panaccessService.validateSession();

        if (isValid) {
          console.log('[AuthValidator] SessionId válido');
          return;
        }

        // Si la validación falla, intentar login automático con credenciales guardadas
        const encryptedUsername = localStorage.getItem('encrypted_username');
        const encryptedPassword = localStorage.getItem('encrypted_password');

        if (!encryptedUsername || !encryptedPassword) {
          console.log('[AuthValidator] No hay credenciales guardadas. Redirigiendo a Login...');
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

        console.log('[AuthValidator] Intentando login automático...');
        await panaccessService.login(username, password);
        console.log('[AuthValidator] Login automático exitoso');

      } catch (error) {
        console.error('[AuthValidator] Error en validación:', error);
        // Limpiar storage y redirigir a login
        localStorage.removeItem('cvSessionId');
        localStorage.removeItem('encrypted_username');
        localStorage.removeItem('encrypted_password');
        navigate('/');
      }
    };

    validateSession();
  }, [navigate]);

  return null;
}

export default useAuthValidator;
