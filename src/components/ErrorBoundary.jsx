import { Component, createRef } from 'react';
import i18n from '@appvideo/core/locales/i18n';
import { reportError } from '../utils/errorReporting';

/** Mensajes de un chunk que no cargó o llegó como HTML (típico tras un deploy con caché vieja). */
export function isStaleChunkMessage(message) {
  const m = String(message || '');
  return (
    m.includes('fetch dynamically imported module') ||
    m.includes('Failed to load module script') ||
    m.includes('Importing a module script failed') ||
    m.includes('text/html') ||
    /Unexpected token '?<'?/.test(m)
  );
}

/**
 * Captura fallos de render en TV/navegadores sin consola accesible.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retryRef = createRef();
  }

  componentDidUpdate(prevProps, prevState) {
    // Otra ruta: se descarta el error en vez de dejar la pantalla de fallo pegada.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
      return;
    }
    if (this.state.error && !prevState.error) this.retryRef.current?.focus();
  }

  retry = () => this.setState({ error: null });

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
    if (isStaleChunkMessage(error?.message)) this.reloadOnceWhenOnline();
  }

  componentDidMount() {
    // Un chunk viejo (deploy nuevo con la app abierta) que el servidor responde con el HTML de la app
    // no rechaza la promesa del import: llega como error global de sintaxis y dejaba la pantalla en blanco.
    this.onWindowError = (e) => {
      if (/\/assets\//.test(e?.filename || '') && isStaleChunkMessage(e?.message)) this.reloadOnceWhenOnline();
    };
    window.addEventListener('error', this.onWindowError);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
  }

  reloadOnceWhenOnline() {
    const reloadKey = 'app_reloaded_from_error';
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, '1');
    this.reloadWhenOnline();
  }

  /**
   * Un chunk que falla al cargar suele ser síntoma de un corte de red real
   * (no solo un deploy con hash viejo) — recargar de inmediato en ese caso
   * navega hacia la misma red caída y el propio reload de "recuperación"
   * vuelve con 404/error de red, dejando la app sin ningún JS corriendo para
   * reintentar (visto en producción: el reload de `windtv.wind.do` volvió
   * con 404 durante un corte). Por eso, si el navegador ya sabe que está
   * offline, se espera al evento `online` (con tope de 15s por si nunca
   * llega) antes de recargar.
   */
  reloadWhenOnline() {
    const doReload = () => window.location.reload();
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      doReload();
      return;
    }
    let done = false;
    const onOnline = () => {
      if (done) return;
      done = true;
      doReload();
    };
    window.addEventListener('online', onOnline, { once: true });
    setTimeout(() => {
      if (done) return;
      done = true;
      window.removeEventListener('online', onOnline);
      doReload();
    }, 15000);
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
          {/* Sin un elemento enfocable el control remoto de la TV no puede hacer nada aquí. */}
          <button
            ref={this.retryRef}
            type="button"
            autoFocus
            onClick={this.retry}
            style={{ fontSize: 22, padding: '12px 28px', borderRadius: 10, border: '2px solid #fff', background: '#0a4385', color: '#fff' }}
          >
            {i18n.t('common.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
