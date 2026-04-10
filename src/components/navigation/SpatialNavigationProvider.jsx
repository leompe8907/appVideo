/**
 * Provider de Navegación Espacial
 * Inicializa la librería @noriginmedia/norigin-spatial-navigation solo en dispositivos TV
 */

import { useEffect } from 'react';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import { useDevice } from '../../contexts/DeviceContext';
import { useBrand } from '../../contexts/BrandContext';

export function SpatialNavigationProvider({ children }) {
  const { isTV } = useDevice();
  const { currentBrand } = useBrand();

  useEffect(() => {
    if (!isTV) return;

    // Puente para interceptar 'Enter' en inputs antes de que llegue a norigin
    // Esto es crucial para la activación del Teclado Virtual en TVs (Paso 2 del plan)
    const virtualKeyboardBridge = (e) => {
      const key = e.key || e.code;
      const keyCode = e.keyCode || e.which;
      const numeric = Number(keyCode);
      const isEnter = key === 'Enter' || numeric === 13 || numeric === 29443;

      if (isEnter) {
        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        
        if (isInput) {
          // Detener la propagación oculta el evento a norigin-spatial-navigation.
          // Eventos como el 'Enter' podrán accionar la apertura nativa del teclado virtual en LG/Samsung.
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', virtualKeyboardBridge, { capture: true });

    try {
      // 1. Forzar focus inicial en root para activar la recepción del teclado en emuladores como Tizen
      const rootEl = document.getElementById('root');
      if (rootEl) {
        if (!rootEl.hasAttribute('tabindex')) rootEl.setAttribute('tabindex', '-1');
        // WebViews Tizen/webOS antiguos pueden fallar con focus({ preventScroll: true })
        try {
          if (typeof rootEl.focus === 'function') rootEl.focus();
        } catch (_) {}
      }

      // 2. Registrar teclas específicas en Tizen (Back, Return, etc.)
      const tvInput = window?.tizen?.tvinputdevice;
      if (tvInput?.registerKeyBatch) {
        tvInput.registerKeyBatch(['Back', 'Exit', 'Return', 'Enter']);
      } else if (tvInput?.registerKey) {
        ['Back', 'Exit', 'Return', 'Enter'].forEach((k) => {
          try { tvInput.registerKey(k); } catch (_) {}
        });
      }

      const initNav = SpatialNavigation.initNavigation || SpatialNavigation.init || SpatialNavigation.default?.initNavigation;
      const setKeys = SpatialNavigation.setKeyMap || SpatialNavigation.setKeys || SpatialNavigation.default?.setKeyMap;

      if (initNav && typeof initNav === 'function') {
        const debugEnabled = import.meta.env.VITE_SPATIAL_NAV_DEBUG === 'true' || currentBrand?.debug?.spatialNav === true;
        const visualDebug = import.meta.env.VITE_SPATIAL_NAV_VISUAL_DEBUG === 'true' || currentBrand?.debug?.spatialNavVisual === true;

        initNav({
          debug: debugEnabled,
          visualDebug: visualDebug,
          // Sincronizar foco DOM con el foco espacial: necesario para que webOS/Tizen
          // asocien el campo activo y abran el teclado virtual al pulsar OK.
          shouldFocusDOMNode: true,
          domNodeFocusOptions: { preventScroll: true },
        });

        if (setKeys && typeof setKeys === 'function') {
          // Key mapping garantizado para plataformas Tizen y webOS
          setKeys({
            up: [38, 211, 'ArrowUp', 'Up'],
            down: [40, 212, 'ArrowDown', 'Down'],
            left: [37, 214, 'ArrowLeft', 'Left'],
            right: [39, 213, 'ArrowRight', 'Right'],
            enter: [13, 29443, 'Enter', 'NumpadEnter', 'OK', 'Select']
          });
        }
        
        if (import.meta.env.DEV) {
          console.log('🎮 [SpatialNavigation] Inicializado OK para TV');
        }
      }
    } catch (error) {
      console.error('[SpatialNavigation] Error:', error);
    }

    return () => {
      window.removeEventListener('keydown', virtualKeyboardBridge, { capture: true });
    };
  }, [isTV, currentBrand]);

  return <>{children}</>;
}

export default SpatialNavigationProvider;
