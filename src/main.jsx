/**
 * Punto de entrada - Providers + Render
 */

import './locales/i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BrandProvider } from './contexts/BrandContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { AppQueryProvider } from './query/QueryProvider';
import App from './App';

import './styles/main.scss';

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <DeviceProvider>
        <BrandProvider>
          <AppQueryProvider>
            <App />
          </AppQueryProvider>
        </BrandProvider>
      </DeviceProvider>
    </BrowserRouter>
);
