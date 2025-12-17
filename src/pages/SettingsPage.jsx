/**
 * Página de Configuración
 */

import { useState } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { getEnabledFeatures } from '../utils/features';
import { getAllUIConfig, getAllLimits } from '../utils/config';

export function SettingsPage() {
  const [showConfig, setShowConfig] = useState(false);
  const { currentBrand, brand, appName, drm, getImage } = useBrand();
  
  if (!currentBrand) {
    return <div className="loading">Cargando...</div>;
  }
  
  const enabledFeatures = getEnabledFeatures(currentBrand);
  const uiConfig = getAllUIConfig(currentBrand);
  const limits = getAllLimits(currentBrand);

  return (
    <div className="settings-page">
      <h1>Configuración</h1>

      <section className="settings-section">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2>Información del Sistema</h2>
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className="btn btn-outline-primary"
          >
            {showConfig ? 'Ocultar Detalles' : 'Ver Detalles'}
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <ul className="list-unstyled">
              <li><strong>Brand:</strong> {brand}</li>
              <li><strong>App:</strong> {appName}</li>
              <li><strong>Versión:</strong> {currentBrand.version || 'N/A'}</li>
              <li><strong>DRM:</strong> {drm}</li>
              {currentBrand.developedBy && (
                <li><strong>Desarrollado por:</strong> {currentBrand.developedBy}</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {showConfig && (
        <>
          {/* Configuración UI */}
          <section className="settings-section">
            <h2>🎨 Configuración UI</h2>
            <div className="card">
              <div className="card-body">
                <ul className="list-unstyled">
                  <li><strong>Logo Position:</strong> {uiConfig.logoPositionHome}</li>
                  <li><strong>Show Time:</strong> {uiConfig.showTime ? 'Sí' : 'No'}</li>
                  <li><strong>Theme:</strong> {uiConfig.theme}</li>
                  <li><strong>Font:</strong> {uiConfig.fontFamily}</li>
                  <li>
                    <strong>Primary Color:</strong> 
                    <span style={{ 
                      display: 'inline-block', 
                      width: '30px', 
                      height: '20px', 
                      backgroundColor: uiConfig.primaryColor,
                      marginLeft: '10px',
                      verticalAlign: 'middle',
                      border: '1px solid #ccc'
                    }} />
                    {uiConfig.primaryColor}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Límites */}
          <section className="settings-section">
            <h2>⚙️ Límites y Restricciones</h2>
            <div className="card">
              <div className="card-body">
                <ul className="list-unstyled">
                  <li><strong>Max Profiles:</strong> {limits.maxProfiles}</li>
                  <li><strong>Max Downloads:</strong> {limits.maxDownloads}</li>
                  <li><strong>Concurrent Streams:</strong> {limits.concurrentStreams}</li>
                  <li><strong>Recording Duration:</strong> {limits.recordingMaxDuration} min</li>
                  <li><strong>Watchlist Items:</strong> {limits.watchlistMaxItems}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="settings-section">
            <h2>🎛️ Features Habilitadas</h2>
            <div className="card">
              <div className="card-body">
                <div className="features-grid">
                  {Object.entries(currentBrand.features || {}).map(([name, enabled]) => (
                    <span 
                      key={name} 
                      className={`feature-badge ${enabled ? 'enabled' : 'disabled'}`}
                    >
                      {enabled ? '✓' : '✗'} {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Assets Info */}
          <section className="settings-section">
            <h2>📁 Rutas de Assets</h2>
            <div className="card">
              <div className="card-body">
                <code>{getImage('logo.png')}</code>
                <p className="mt-2">Coloca tus imágenes en: <strong>/public/{brand}/</strong></p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default SettingsPage;

