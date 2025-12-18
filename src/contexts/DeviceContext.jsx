import React, { createContext, useContext } from 'react';
import { useDeviceDetection } from '../hooks/useDeviceDetection';

const DeviceContext = createContext(null);

/**
 * Hook para usar el Device Context
 * @returns {object} Información del dispositivo
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice debe usarse dentro de DeviceProvider');
  }
  return context;
};

/**
 * Provider del Device Context
 * Detecta y proporciona información del dispositivo (TV vs PC)
 */
export const DeviceProvider = ({ children }) => {
  const deviceInfo = useDeviceDetection();

  // Agregar clases al root según el dispositivo
  React.useEffect(() => {
    const root = document.documentElement;
    
    // Remover clases anteriores
    root.classList.remove('device-tv', 'device-pc');
    
    // Agregar clase según dispositivo
    if (deviceInfo.isTV) {
      root.classList.add('device-tv');
    } else {
      root.classList.add('device-pc');
    }

    // Agregar atributo data-device para CSS
    root.setAttribute('data-device', deviceInfo.deviceType);
  }, [deviceInfo.isTV, deviceInfo.deviceType]);

  const value = {
    // Estado
    ...deviceInfo,
    
    // Helpers directos
    get isTV() {
      return deviceInfo.isTV;
    },
    get isPC() {
      return deviceInfo.isPC;
    },
    get deviceType() {
      return deviceInfo.deviceType;
    },
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
};

