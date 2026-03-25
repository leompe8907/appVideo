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

    // Puentes Tizen (deben estar en scope para cleanup)
    let tizenKeydownBridge = null;
    let tizenKeyupBridge = null;

    try {
      // En algunos emuladores (especialmente Tizen) si no hay un elemento focuseado
      // el runtime no entrega eventos de teclado/remote correctamente.
      // Hacemos el root focuseable y forzamos focus al montar.
      const rootEl = document.getElementById('root');
      if (rootEl) {
        if (!rootEl.hasAttribute('tabindex')) rootEl.setAttribute('tabindex', '-1');
        // Intentar tomar foco sin scroll.
        rootEl.focus?.({ preventScroll: true });
      }
      window.focus?.();

      // Registrar teclas en Tizen cuando esté disponible (no rompe si no existe).
      // (Algunas teclas especiales requieren registro para que el emulador las entregue).
      try {
        const tvInput = window?.tizen?.tvinputdevice;
        if (tvInput?.registerKeyBatch) {
          tvInput.registerKeyBatch(['Back', 'Exit', 'Return', 'Enter']);
        } else if (tvInput?.registerKey) {
          ['Back', 'Exit', 'Return', 'Enter'].forEach((k) => {
            try {
              tvInput.registerKey(k);
            } catch (_) {
              // ignore
            }
          });
        }
      } catch (_) {
        // ignore
      }

      // Workaround Tizen Emulator:
      // Algunos builds no disparan/propagan las teclas al listener interno de la librería.
      // Capturamos keydown y delegamos explícitamente a SpatialNavigation.
      const isTizen = typeof window !== 'undefined' && (!!window.tizen || !!window.webapis);
      const snSingleton = SpatialNavigation.SpatialNavigation;
      const snNavigate = SpatialNavigation.navigateByDirection || snSingleton?.navigateByDirection?.bind(snSingleton);
      const snEnter = snSingleton?.onEnterPress?.bind(snSingleton);
      const snEnterUp = snSingleton?.onEnterRelease?.bind(snSingleton);

      const normalizeKey = (e) => {
        const key = e?.key;
        const code = e?.code;
        const keyCode = e?.keyCode;
        const which = e?.which;
        const k = key || code || keyCode || which;
        return { key, code, keyCode, which, k };
      };

      tizenKeydownBridge = (e) => {
        if (!isTizen) return;
        const { key, code, keyCode, which } = normalizeKey(e);
        const numeric = Number(keyCode ?? which);

        // Mapeos comunes Tizen: arrows/enter suelen ser estándar, pero emulador varía.
        const isUp = key === 'ArrowUp' || code === 'ArrowUp' || numeric === 38 || numeric === 65362;
        const isDown = key === 'ArrowDown' || code === 'ArrowDown' || numeric === 40 || numeric === 65364;
        const isLeft = key === 'ArrowLeft' || code === 'ArrowLeft' || numeric === 37 || numeric === 65361;
        const isRight = key === 'ArrowRight' || code === 'ArrowRight' || numeric === 39 || numeric === 65363;
        const isEnter = key === 'Enter' || code === 'Enter' || numeric === 13 || numeric === 29443;

        if (!(isUp || isDown || isLeft || isRight || isEnter)) return;

        // Evitar que el foco nativo del input "trague" flechas/enter.
        e.preventDefault?.();
        e.stopPropagation?.();

        if (isEnter) {
          snEnter?.({ pressedKeys: {} });
          return;
        }
        if (isUp) snNavigate?.('up', { event: e, nativeEvent: e });
        else if (isDown) snNavigate?.('down', { event: e, nativeEvent: e });
        else if (isLeft) snNavigate?.('left', { event: e, nativeEvent: e });
        else if (isRight) snNavigate?.('right', { event: e, nativeEvent: e });
      };

      tizenKeyupBridge = (e) => {
        if (!isTizen) return;
        const numeric = Number(e?.keyCode ?? e?.which);
        const isEnter = e?.key === 'Enter' || e?.code === 'Enter' || numeric === 13 || numeric === 29443;
        if (!isEnter) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        snEnterUp?.();
      };

      window.addEventListener('keydown', tizenKeydownBridge, { capture: true });
      window.addEventListener('keyup', tizenKeyupBridge, { capture: true });

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
            // Incluimos variantes por emulador/firmware.
            up: [38, 211, 'ArrowUp', 'Up'],
            down: [40, 212, 'ArrowDown', 'Down'],
            left: [37, 214, 'ArrowLeft', 'Left'],
            right: [39, 213, 'ArrowRight', 'Right'],
            enter: [13, 29443, 'Enter', 'NumpadEnter', 'OK', 'Select']
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
      try {
        if (tizenKeydownBridge) window.removeEventListener('keydown', tizenKeydownBridge, { capture: true });
        if (tizenKeyupBridge) window.removeEventListener('keyup', tizenKeyupBridge, { capture: true });
      } catch (_) {
        // ignore
      }
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

