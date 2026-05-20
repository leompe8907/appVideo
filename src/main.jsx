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
import { runCompatCheck, showCompatError } from './utils/compatCheck';

import './styles/main.scss';

// Foco visible (PC + 10-foot): aplica/quita clase `.focused` automáticamente.
// Controlado por bandera: html[data-focus="on|off"] (setea BrandTheme).
// Nota: lo hacemos global para no duplicar lógica por pantalla.
(() => {
  if (typeof window === 'undefined') return;
  if (window.__tvFocusWired) return;
  window.__tvFocusWired = true;

  const isInteractive = (el) => {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'button' || tag === 'select' || tag === 'textarea') return true;
    if (tag === 'a' && el.getAttribute('href')) return true;
    if (el.getAttribute('role') === 'button') return true;
    if (el.tabIndex >= 0) return true;
    return false;
  };

  const shouldApply = () => {
    try {
      return document.documentElement.getAttribute('data-focus') !== 'off';
    } catch {
      return true;
    }
  };

  document.addEventListener(
    'focusin',
    (e) => {
      if (!shouldApply()) return;
      const el = e.target;
      if (!isInteractive(el)) return;
      try {
        el.classList.add('focused');
        el.setAttribute('data-focusable', 'true');
      } catch {
        // noop
      }
    },
    true
  );

  document.addEventListener(
    'focusout',
    (e) => {
      const el = e.target;
      if (!isInteractive(el)) return;
      try {
        el.classList.remove('focused');
      } catch {
        // noop
      }
    },
    true
  );
})();

const routerBasename = (() => {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return undefined;
  const trimmed = base.replace(/\/$/, '');
  return trimmed || undefined;
})();

const compatIssues = runCompatCheck();
const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[main] No se encontró #root en el DOM');
} else if (compatIssues.length > 0) {
  showCompatError(compatIssues);
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
