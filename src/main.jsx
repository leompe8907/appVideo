/**
 * Punto de entrada - Providers + Render
 * Compatibilidad: Samsung Tizen 4/5 (~2019), LG webOS 4/5 (~2019)
 *
 * ReactDOM.render (API clásica): algunos WebViews de TV se comportan mejor que createRoot.
 */

import './locales/i18n';
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { BrandProvider } from './contexts/BrandContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { AppQueryProvider } from './query/QueryProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';

import './styles/main.scss';

const routerBasename = (() => {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return undefined;
  const trimmed = base.replace(/\/$/, '');
  return trimmed || undefined;
})();

const rootEl = document.getElementById('root');
if (!rootEl) {
  // eslint-disable-next-line no-console
  console.error('[main] No se encontró #root en el DOM');
} else {
  ReactDOM.render(
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        <DeviceProvider>
          <BrandProvider>
            <AppQueryProvider>
              <App />
            </AppQueryProvider>
          </BrandProvider>
        </DeviceProvider>
      </BrowserRouter>
    </ErrorBoundary>,
    rootEl
  );
}
