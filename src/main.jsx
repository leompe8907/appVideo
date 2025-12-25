/**
 * Punto de entrada - Providers + Render
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BrandProvider } from './contexts/BrandContext';
import { DeviceProvider } from './contexts/DeviceContext';
import App from './App';

import './styles/main.scss';

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
