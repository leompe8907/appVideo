/**
 * Provider de Navegación Espacial
 * Inicializa la librería @noriginmedia/norigin-spatial-navigation solo en dispositivos TV
 */

import { useEffect } from 'react';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import { useDevice } from '../../contexts/DeviceContext';
import { useBrand } from '../../contexts/BrandContext';

/**
 * Provider que inicializa la navegación espacial para controles remotos de TV
 * Solo se activa en dispositivos TV (LG webOS, Samsung Tizen, etc.)
 * En PC/notebook no hace nada, manteniendo la navegación nativa del navegador
 */
export function SpatialNavigationProvider({ children }) {
  const { isTV } = useDevice();
  const { currentBrand } = useBrand();

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
        // Banderas para controlar el debug
        // Prioridad: 1. Variable de entorno > 2. Configuración del brand > 3. Default
        
        // Debug en consola (logs)
        // Variable de entorno tiene máxima prioridad
        const envDebug = import.meta.env.VITE_SPATIAL_NAV_DEBUG;
        const brandDebug = currentBrand?.debug?.spatialNav;
        
        let enableDebug;
        if (envDebug === 'true' || envDebug === 'false') {
          // Variable de entorno tiene prioridad
          enableDebug = envDebug === 'true';
        } else if (brandDebug !== undefined) {
          // Usar configuración del brand
          enableDebug = brandDebug;
        } else {
          // Default: solo en desarrollo
          enableDebug = import.meta.env.DEV;
        }
        
        // Debug visual (marcos rojos)
        // Variable de entorno tiene máxima prioridad
        const envVisualDebug = import.meta.env.VITE_SPATIAL_NAV_VISUAL_DEBUG;
        const brandVisualDebug = currentBrand?.debug?.spatialNavVisual;
        
        let enableVisualDebug;
        if (envVisualDebug === 'true' || envVisualDebug === 'false') {
          // Variable de entorno tiene prioridad
          enableVisualDebug = envVisualDebug === 'true';
        } else if (brandVisualDebug !== undefined) {
          // Usar configuración del brand
          enableVisualDebug = brandVisualDebug;
        } else {
          // Default: desactivado
          enableVisualDebug = false;
        }
        
        // Inicializar navegación espacial
        initNav({
          // Debug en consola (logs)
          debug: enableDebug,
          // Visual debug (marcos y textos rojos en pantalla)
          visualDebug: enableVisualDebug,
        });

        // Configurar mapeo de teclas del control remoto si está disponible
        // Compatible con LG webOS 2019+ y Samsung Tizen 2019+
        if (setKeys && typeof setKeys === 'function') {
          setKeys({
            // Mapeo correcto de acuerdo a norigin-spatial-navigation:
            // Acción (up, down, left, right, enter) -> Arreglo de KeyCodes (números y strings)
            up: [38, 211, 'ArrowUp'],
            down: [40, 212, 'ArrowDown'],
            left: [37, 214, 'ArrowLeft'],
            right: [39, 213, 'ArrowRight'],
            enter: [13, 29443, 'Enter', 'NumpadEnter']
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
  }, [isTV, currentBrand]);

  // Renderizar children sin wrapper adicional
  // La librería funciona globalmente una vez inicializada
  return <>{children}</>;
}

export default SpatialNavigationProvider;

