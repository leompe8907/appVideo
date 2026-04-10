import { Component } from 'react';

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
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info?.componentStack);
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
          <h1 style={{ fontSize: 22, marginTop: 0 }}>Error al cargar la aplicación</h1>
          <p style={{ opacity: 0.9 }}>En PC abre las herramientas de desarrollador; en TV revisa la red y la URL base.</p>
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
