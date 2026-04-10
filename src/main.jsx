/**
 * Punto de entrada - Providers + Render
 * Compatibilidad: Tizen 4/5 (LG 2019), webOS 4/5 (Samsung 2019)
 */

import './locales/i18n';
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { BrandProvider } from './contexts/BrandContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { AppQueryProvider } from './query/QueryProvider';
import App from './App';

import './styles/main.scss';

/** ErrorBoundary inline — muestra el error real en pantalla en la TV */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: {
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: '#8B0000',
          color: '#FFFFFF',
          padding: '40px',
          fontFamily: 'monospace',
          fontSize: '28px',
          overflow: 'auto',
          zIndex: 99999,
        }
      },
        React.createElement('div', { style: { marginBottom: 20, fontSize: 36, fontWeight: 'bold' } }, '⚠ Error de aplicación'),
        React.createElement('div', { style: { marginBottom: 16, color: '#FFD700' } }, String(this.state.error)),
        React.createElement('pre', { style: { fontSize: 20, whiteSpace: 'pre-wrap', wordBreak: 'break-all' } },
          this.state.error && this.state.error.stack
        )
      );
    }
    return this.props.children;
  }
}

/** Base URL alineada con Vite `base` (builds por marca bajo /{brand}/) */
var routerBasename = (function() {
  var base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  if (base === '/') return undefined;
  var trimmed = base.replace(/\/$/, '');
  return trimmed || undefined;
})();

/** Guard: si el div#root no existe, no explota silenciosamente */
var rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[main] No se encontró #root en el DOM');
} else {
  ReactDOM.render(
    React.createElement(
      ErrorBoundary, null,
      React.createElement(
        BrowserRouter, { basename: routerBasename },
        React.createElement(
          DeviceProvider, null,
          React.createElement(
            BrandProvider, null,
            React.createElement(
              AppQueryProvider, null,
              React.createElement(App, null)
            )
          )
        )
      )
    ),
    rootEl
  );
}
