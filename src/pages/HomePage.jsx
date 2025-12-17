/**
 * Página Home / Dashboard
 */

import { useBrand } from '../contexts/BrandContext';

export function HomePage() {
  const { drm, token, appName } = useBrand();

  return (
    <div className="home-page">
      <section className="welcome-section">
        <h2>Conexión Panaccess Activa</h2>
        <p>Estás conectado al sistema OTT de <strong>{appName}</strong></p>
        <div className="connection-info">
          <p><strong>DRM:</strong> {drm}</p>
          <p><strong>Token:</strong> {token.substring(0, 10)}...</p>
        </div>
        <p className="next-steps">Próximos pasos: Implementar listado de canales, EPG, reproductor...</p>
      </section>

      <section className="quick-actions">
        <h3>Acceso Rápido</h3>
        <div className="actions-grid">
          <a href="/channels" className="action-card">
            <span className="icon">📺</span>
            <h4>Canales en Vivo</h4>
            <p>Ver programación en vivo</p>
          </a>
          
          <a href="/vod" className="action-card">
            <span className="icon">🎬</span>
            <h4>Video On Demand</h4>
            <p>Contenido a la carta</p>
          </a>
          
          <a href="/epg" className="action-card">
            <span className="icon">📅</span>
            <h4>Guía EPG</h4>
            <p>Programación completa</p>
          </a>
          
          <a href="/settings" className="action-card">
            <span className="icon">⚙️</span>
            <h4>Configuración</h4>
            <p>Ajustes de la app</p>
          </a>
        </div>
      </section>
    </div>
  );
}

export default HomePage;

