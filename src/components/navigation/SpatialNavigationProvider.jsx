/**
 * Provider de Navegación Espacial
 * Inicializa la librería @noriginmedia/norigin-spatial-navigation solo en dispositivos TV
 */

import { useEffect } from 'react';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import { useDevice } from '../../contexts/DeviceContext';

/**
 * Provider que inicializa la navegación espacial para controles remotos de TV
 * Solo se activa en dispositivos TV (LG webOS, Samsung Tizen, etc.)
 * En PC/notebook no hace nada, manteniendo la navegación nativa del navegador
 */
export function SpatialNavigationProvider({ children }) {
  const { isTV } = useDevice();

  useEffect(() => {
    // Solo inicializar en dispositivos TV
    if (!isTV) {
      return;
    }

    try {
      // Intentar inicializar navegación espacial
      // La librería puede tener diferentes formas de exportar estas funciones
      const initNav = SpatialNavigation.initNavigation || SpatialNavigation.init || SpatialNavigation.default?.initNavigation;
      const setKeys = SpatialNavigation.setKeyMap || SpatialNavigation.setKeys || SpatialNavigation.default?.setKeyMap;

      if (initNav && typeof initNav === 'function') {
        // Inicializar navegación espacial
        initNav({
          // Activar debug solo en desarrollo
          debug: import.meta.env.DEV,
          // Visual debug muestra líneas de conexión entre elementos (solo en desarrollo)
          visualDebug: import.meta.env.DEV,
        });

        // Configurar mapeo de teclas del control remoto si está disponible
        // Compatible con LG webOS 2019 y Samsung Tizen 2019
        if (setKeys && typeof setKeys === 'function') {
          setKeys({
            // Flechas direccionales (estándar en todos los controles remotos)
            ArrowUp: 'up',
            ArrowDown: 'down',
            ArrowLeft: 'left',
            ArrowRight: 'right',
            
            // Tecla Enter/OK del control remoto
            Enter: 'enter',
            ' ': 'enter', // Espacio también actúa como Enter
            
            // Botón Back/Return del control remoto
            Backspace: 'back',
            Escape: 'back',
          });
        }

        // Log en desarrollo para verificar inicialización
        if (import.meta.env.DEV) {
          console.log('🎮 [SpatialNavigation] Inicializado para TV');
        }
      } else {
        // Si no hay función de inicialización, la librería puede inicializarse automáticamente
        // Solo loguear en desarrollo
        if (import.meta.env.DEV) {
          console.log('🎮 [SpatialNavigation] La librería se inicializará automáticamente al usar useFocusable');
        }
      }
    } catch (error) {
      // Manejar errores de inicialización sin romper la app
      console.error('🎮 [SpatialNavigation] Error al inicializar:', error);
      if (import.meta.env.DEV) {
        console.warn('🎮 [SpatialNavigation] Continuando sin inicialización explícita. La librería puede funcionar automáticamente.');
      }
    }

    // Cleanup: la librería no requiere cleanup explícito,
    // pero podemos agregar lógica aquí si es necesario en el futuro
    return () => {
      if (import.meta.env.DEV) {
        console.log('🎮 [SpatialNavigation] Desmontado');
      }
    };
  }, [isTV]);

  // Renderizar children sin wrapper adicional
  // La librería funciona globalmente una vez inicializada
  return <>{children}</>;
}

export default SpatialNavigationProvider;

