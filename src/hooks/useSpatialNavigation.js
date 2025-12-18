/**
 * Hook para navegación espacial en TVs
 * Implementación propia compatible con React 19
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Almacén global de elementos focusables
const focusableElements = new Map();
let currentFocusKey = null;
let isInitialized = false;

// Configuración
const config = {
  throttleKeyDown: 100, // ms entre eventos de tecla
  focusableSelector: '[data-focusable="true"]',
};

// Último tiempo de keydown (para throttling)
let lastKeyDownTime = 0;

/**
 * Limpia todos los focos (útil al inicializar)
 */
export function clearAllFocus() {
  focusableElements.forEach((item) => {
    if (item.element) {
      item.element.classList.remove('focused');
      item.callbacks.onBlur?.();
    }
  });
  currentFocusKey = null;
}

/**
 * Inicializa la navegación espacial
 */
export function initSpatialNavigation() {
  if (isInitialized) return;
  
  // Limpiar cualquier foco previo
  clearAllFocus();
  
  const handleKeyDown = (event) => {
    const now = Date.now();
    if (now - lastKeyDownTime < config.throttleKeyDown) return;
    lastKeyDownTime = now;

    const { key } = event;
    
    // Mapeo de teclas (incluye controles remotos de TV)
    const keyMap = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Enter': 'enter',
      ' ': 'enter', // Espacio
      'Escape': 'back',
      'Backspace': 'back',
      // Teclas adicionales para controles remotos
      '38': 'up',    // Código de tecla para arriba
      '40': 'down',  // Código de tecla para abajo
      '37': 'left',  // Código de tecla para izquierda
      '39': 'right', // Código de tecla para derecha
      '13': 'enter', // Código de tecla para Enter
      '27': 'back',  // Código de tecla para Escape
      '8': 'back',   // Código de tecla para Backspace
    };

    const direction = keyMap[key] || keyMap[event.keyCode];
    
    if (!direction) return;

    // Prevenir comportamiento por defecto para teclas de navegación
    if (['up', 'down', 'left', 'right'].includes(direction)) {
      event.preventDefault();
      navigateByDirection(direction);
    } else if (direction === 'enter') {
      event.preventDefault();
      triggerEnter();
    } else if (direction === 'back') {
      // No prevenir, dejar que el navegador maneje "back"
      triggerBack();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  isInitialized = true;
  console.log('[SpatialNav] Navegación espacial inicializada');
  
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    isInitialized = false;
  };
}

/**
 * Registra un elemento focusable
 */
export function registerFocusable(focusKey, element, callbacks = {}) {
  // Asegurar que el elemento no tenga la clase focused inicialmente
  if (element) {
    element.classList.remove('focused');
  }
  
  focusableElements.set(focusKey, {
    element,
    callbacks,
    rect: null, // Se calcula dinámicamente
  });
  
  // NO establecer foco automáticamente aquí
  // El foco inicial debe ser manejado por el componente/página específica
  // Esto evita que múltiples elementos reciban foco al montarse simultáneamente
}

/**
 * Desregistra un elemento focusable
 */
export function unregisterFocusable(focusKey) {
  focusableElements.delete(focusKey);
  
  // Si el elemento desregistrado tenía foco, mover a otro
  if (currentFocusKey === focusKey) {
    const keys = Array.from(focusableElements.keys());
    if (keys.length > 0) {
      setFocus(keys[0]);
    } else {
      currentFocusKey = null;
    }
  }
}

/**
 * Establece el foco en un elemento
 */
export function setFocus(focusKey) {
  // Desenfocar TODOS los elementos primero (por si acaso)
  focusableElements.forEach((item, key) => {
    if (key !== focusKey && item.element) {
      item.element.classList.remove('focused');
    }
  });
  
  // Desenfocar elemento actual explícitamente
  if (currentFocusKey && currentFocusKey !== focusKey) {
    const current = focusableElements.get(currentFocusKey);
    if (current && current.element) {
      current.element.classList.remove('focused');
      current.callbacks.onBlur?.();
    }
  }
  
  // Enfocar nuevo elemento
  const next = focusableElements.get(focusKey);
  if (next && next.element) {
    currentFocusKey = focusKey;
    next.element.classList.add('focused');
    next.element.focus?.();
    next.callbacks.onFocus?.();
    
    // Scroll into view si es necesario
    next.element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Obtiene el focusKey actual
 */
export function getCurrentFocusKey() {
  return currentFocusKey;
}

/**
 * Navega en una dirección
 */
function navigateByDirection(direction) {
  if (!currentFocusKey) {
    // Si no hay foco, enfocar el primer elemento
    const firstKey = Array.from(focusableElements.keys())[0];
    if (firstKey) setFocus(firstKey);
    return;
  }

  const current = focusableElements.get(currentFocusKey);
  if (!current || !current.element) return;

  // Obtener rect del elemento actual
  const currentRect = current.element.getBoundingClientRect();
  
  let bestCandidate = null;
  let bestDistance = Infinity;

  focusableElements.forEach((item, key) => {
    if (key === currentFocusKey) return;
    if (!item.element) return;

    const rect = item.element.getBoundingClientRect();
    
    // Calcular si el elemento está en la dirección correcta
    let isInDirection = false;
    let distance = Infinity;

    switch (direction) {
      case 'up':
        isInDirection = rect.bottom <= currentRect.top + 10;
        if (isInDirection) {
          distance = Math.abs(currentRect.top - rect.bottom) + 
                    Math.abs((currentRect.left + currentRect.right) / 2 - (rect.left + rect.right) / 2) * 0.5;
        }
        break;
      case 'down':
        isInDirection = rect.top >= currentRect.bottom - 10;
        if (isInDirection) {
          distance = Math.abs(rect.top - currentRect.bottom) + 
                    Math.abs((currentRect.left + currentRect.right) / 2 - (rect.left + rect.right) / 2) * 0.5;
        }
        break;
      case 'left':
        isInDirection = rect.right <= currentRect.left + 10;
        if (isInDirection) {
          distance = Math.abs(currentRect.left - rect.right) + 
                    Math.abs((currentRect.top + currentRect.bottom) / 2 - (rect.top + rect.bottom) / 2) * 0.5;
        }
        break;
      case 'right':
        isInDirection = rect.left >= currentRect.right - 10;
        if (isInDirection) {
          distance = Math.abs(rect.left - currentRect.right) + 
                    Math.abs((currentRect.top + currentRect.bottom) / 2 - (rect.top + rect.bottom) / 2) * 0.5;
        }
        break;
    }

    if (isInDirection && distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = key;
    }
  });

  if (bestCandidate) {
    setFocus(bestCandidate);
  }
}

/**
 * Dispara evento Enter en el elemento actual
 */
function triggerEnter() {
  if (!currentFocusKey) return;
  
  const current = focusableElements.get(currentFocusKey);
  if (current) {
    current.callbacks.onEnterPress?.();
    // También hacer click en el elemento
    current.element?.click?.();
  }
}

/**
 * Dispara evento Back
 */
function triggerBack() {
  // Callback global de back si existe
  if (typeof window !== 'undefined' && window.__spatialNavBackHandler) {
    window.__spatialNavBackHandler();
  }
}

/**
 * Hook para usar la navegación espacial
 */
export function useSpatialNavigation() {
  useEffect(() => {
    const cleanup = initSpatialNavigation();
    return cleanup;
  }, []);

  return {
    setFocus,
    getCurrentFocusKey,
  };
}

/**
 * Hook para hacer un elemento focusable
 */
export function useFocusable({
  focusKey,
  onFocus,
  onBlur,
  onEnterPress,
  focusable = true,
}) {
  const ref = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!focusable || !ref.current) return;

    registerFocusable(focusKey, ref.current, {
      onFocus: () => {
        setIsFocused(true);
        onFocus?.();
      },
      onBlur: () => {
        setIsFocused(false);
        onBlur?.();
      },
      onEnterPress: () => {
        onEnterPress?.();
      },
    });

    return () => {
      unregisterFocusable(focusKey);
    };
  }, [focusKey, focusable, onFocus, onBlur, onEnterPress]);

  const focus = useCallback(() => {
    setFocus(focusKey);
  }, [focusKey]);

  return {
    ref,
    focused: isFocused,
    focusKey,
    focus,
  };
}

