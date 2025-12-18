import React, { createContext, useContext, useEffect } from 'react';
import { useDevice } from './DeviceContext';
import { initSpatialNavigation, setFocus, getCurrentFocusKey } from '../hooks/useSpatialNavigation';

const TVNavigationContext = createContext(null);

/**
 * Hook para usar el TV Navigation Context
 * @returns {object} Funciones y estado de navegación TV
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTVNavigation = () => {
  const context = useContext(TVNavigationContext);
  return context;
};

/**
 * Provider de navegación TV
 * Inicializa la navegación espacial solo cuando es TV
 */
export const TVNavigationProvider = ({ children }) => {
  const { isTV } = useDevice();

  useEffect(() => {
    // Inicializar navegación solo en TV
    if (isTV) {
      const cleanup = initSpatialNavigation();
      console.log('[TVNavigation] Navegación espacial inicializada');
      return cleanup;
    }
  }, [isTV]);

  const value = {
    isActive: isTV,
    setFocus,
    getCurrentFocusKey,
  };

  return (
    <TVNavigationContext.Provider value={value}>
      {children}
    </TVNavigationContext.Provider>
  );
};
