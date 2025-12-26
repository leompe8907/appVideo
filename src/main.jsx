/**
 * Punto de entrada - Providers + Render
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { init } from '@noriginmedia/norigin-spatial-navigation';
import { BrandProvider } from './contexts/BrandContext';
import { DeviceProvider } from './contexts/DeviceContext';
import App from './App';

import './styles/main.scss';

// Inicializar navegación espacial para TVs
// Se ejecuta ANTES del render, una sola vez
init({
  debug: false,           // true para ver logs en consola
  visualDebug: false,     // true para ver bordes de focus (desarrollo)
  distanceCalculationMethod: 'center', // Calcula distancia desde el centro del elemento
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DeviceProvider>
        <BrandProvider>
          <App />
        </BrandProvider>
      </DeviceProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
