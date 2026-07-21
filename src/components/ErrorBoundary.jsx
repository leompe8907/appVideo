import { Component } from 'react';
import i18n from '../locales/i18n';
import { reportError } from '../utils/errorReporting';

/**
 * Captura fallos de render en TV/navegadores sin consola accesible.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }

    reportError(error, {
      context: 'ErrorBoundary',
      extra: { componentStack: info?.componentStack?.slice(0, 2000) },
    });

    // Auto-reload si es un error de carga de chunk (típico post-deploy en Vercel por caché vieja)
    const isChunkError = error && error.message && (
      error.message.includes('fetch dynamically imported module') ||
      error.message.includes('Failed to load module script') ||
      error.message.includes('Importing a module script failed') ||
      error.message.includes('text/html')
    );
    
    if (isChunkError) {
      const reloadKey = 'app_reloaded_from_error';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        return;
      }
    }
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div
          style={{
            padding: 24,
            color: '#fff',
            background: '#1a1a1a',
            fontFamily: 'system-ui, sans-serif',
            minHeight: '100vh',
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ fontSize: 22, marginTop: 0 }}>{i18n.t('errors.loadAppTitle')}</h1>
          <p style={{ opacity: 0.9 }}>{i18n.t('errors.loadAppHint')}</p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#000',
              padding: 12,
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {msg}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
