/**
 * Hook de navegación específico para LoginPage
 * Maneja la lógica de foco y navegación del formulario de login
 */

import { useEffect } from 'react';
import { useDevice } from '../../contexts/DeviceContext';
import { setFocus } from '../useSpatialNavigation';

// Claves de foco para el formulario de login
export const LOGIN_FOCUS_KEYS = {
  USERNAME: 'login-username',
  PASSWORD: 'login-password',
  PASSWORD_TOGGLE: 'login-password-toggle',
  SUBMIT: 'login-submit',
};

/**
 * Hook para manejar la navegación del LoginPage
 * @returns {object} Configuración y funciones de navegación
 */
export function useLoginNavigation() {
  const { isTV } = useDevice();

  // Auto-focus en el input de usuario al montar (solo en TV)
  useEffect(() => {
    if (isTV) {
      // Delay más largo para asegurar que TODOS los elementos están registrados
      // y que no haya conflictos con el registro inicial
      const timer = setTimeout(() => {
        // Verificar que el elemento existe antes de enfocarlo
        const usernameElement = document.querySelector(`[data-focus-key="${LOGIN_FOCUS_KEYS.USERNAME}"]`);
        if (usernameElement) {
          setFocus(LOGIN_FOCUS_KEYS.USERNAME);
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isTV]);

  return {
    focusKeys: LOGIN_FOCUS_KEYS,
    isTV,
  };
}

